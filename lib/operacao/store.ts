import {
  GRUPO_ACESSO_COMUM,
  GRUPO_ADMINISTRADORES,
  GRUPO_EXECUTOR,
  idDeNome,
  papelDosGrupos,
  type DiretivaGrupo,
  type GrupoRegistro,
} from '@/lib/acessos/regras'
import {
  acharLink,
  criarLink,
  emitirLink,
  hashDoToken,
  INTERVALO_SENHA_MS,
  linkRecente,
  motivoDoLink,
  tokenInformado,
  type LinkAcesso,
  type TipoLink,
} from '@/lib/auth/links'
import type { EntregaEstadoRow } from '@/lib/entregas/tipos'
import { nomeCompleto, partirNome } from '@/lib/auth/politica-senha'
import { hashSenha } from '@/lib/auth/senha'
import { cache } from 'react'
import { tirarParticipanteLocal, tirarResponsavelLocal } from '@/lib/projetos/store'
import {
  apagarFora,
  apagarOnde,
  atualizarOnde,
  chamarFuncao,
  colunaQueFalta,
  ehTabelaAusente,
  gravarTabela,
  inserirLinha,
  lerTabela,
  restricaoUnica,
  supabaseConfigurado,
} from '@/lib/supabase/nuvem'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type { DiretivaGrupo, GrupoRegistro } from '@/lib/acessos/regras'
export { GRUPO_ACESSO_COMUM, GRUPO_ADMINISTRADORES, GRUPO_EXECUTOR } from '@/lib/acessos/regras'

export type Papel = 'administrador' | 'comum'
export type SituacaoConta = 'ativa' | 'bloqueada' | 'desativada'

export type Usuario = {
  id: string
  nome: string
  primeiroNome: string
  sobrenome: string
  email: string | null
  celular: string | null
  login: string
  senhaHash: string
  papel: Papel
  ativo: boolean
  situacao: SituacaoConta
  ultimoAcessoEm: string | null
  sessaoGeracao: number
  origem: 'instalacao' | 'pedido'
  ocultarBoasVindas: boolean
}

export type UsuarioPublico = Omit<Usuario, 'senhaHash'> & {
  /** Pertence ao grupo Executor, da aplicação. Nasce fora. Não é um papel. */
  noGrupoExecutor: boolean
}

/** Usado só na validação da senha. Não enviar para páginas. */
export type UsuarioLogin = {
  id: string
  login: string
  senhaHash: string
  papel: Papel
  ativo: boolean
  situacao: SituacaoConta
  sessaoGeracao: number
  ocultarBoasVindas: boolean
}

export type SituacaoPedido = 'pendente' | 'aprovado' | 'rejeitado'

export type PedidoAcesso = {
  id: string
  nome: string
  primeiroNome: string
  sobrenome: string
  email: string
  celular: string
  criadoEm: string
  situacao: SituacaoPedido
  decididoEm: string | null
  decididoPor: string | null
  papel: Papel
  /** Grupo com diretiva em que a conta nasce. Pedido público fica no Acesso comum. */
  grupoId: string | null
  /** Login escolhido na gestão. No pedido público, o e-mail é o login. */
  loginEscolhido: string | null
  noExecutor: boolean
}

export type NivelLog = 'info' | 'alerta' | 'erro'

export type LogRegistro = {
  id: string
  em: string
  nivel: NivelLog
  evento: string
  ator: string | null
  mensagem: string
  detalhe: Record<string, string | number | boolean | null>
}

type Store = {
  usuarios: Usuario[]
  /** Contas do grupo Executor. Espelha o grupo Executor. */
  membrosExecutor: string[]
  grupos: GrupoRegistro[]
  pedidos: PedidoAcesso[]
  links: LinkAcesso[]
  estados: EntregaEstadoRow[]
  logs: LogRegistro[]
}

const ARQUIVO = path.join(process.cwd(), 'data', 'operacao.json')
/** Teto temporário. A retenção definitiva fica para uma etapa posterior. */
const LIMITE_LOGS = 300
/** O caminho antigo ainda regrava o conjunto. Esta janela evita apagar logs numa escrita que não insere evento. */
const JANELA_REESCRITA_LOGS = 400

let fila: Promise<unknown> = Promise.resolve()

async function semear(): Promise<Store> {
  return {
    usuarios: [
      {
        id: 'instalacao-adm',
        nome: 'Administrador',
        primeiroNome: 'Administrador',
        sobrenome: '',
        email: null,
        celular: null,
        login: 'adm',
        senhaHash: await hashSenha('Administrador@001'),
        papel: 'administrador',
        ativo: true,
        situacao: 'ativa',
        ultimoAcessoEm: null,
        sessaoGeracao: 0,
        origem: 'instalacao',
        ocultarBoasVindas: false,
      },
      {
        id: 'instalacao-convidado',
        nome: 'Convidado',
        primeiroNome: 'Convidado',
        sobrenome: '',
        email: null,
        celular: null,
        login: 'convidado',
        senhaHash: await hashSenha('convidado@1'),
        papel: 'comum',
        ativo: true,
        situacao: 'ativa',
        ultimoAcessoEm: null,
        sessaoGeracao: 0,
        origem: 'instalacao',
        ocultarBoasVindas: false,
      },
    ],
    membrosExecutor: [],
    grupos: [
      {
        id: GRUPO_ADMINISTRADORES,
        nome: 'Administradores',
        diretiva: 'administrador',
        sistema: true,
        membros: ['instalacao-adm'],
      },
      {
        id: GRUPO_ACESSO_COMUM,
        nome: 'Acesso comum',
        diretiva: 'acesso_comum',
        sistema: true,
        membros: ['instalacao-convidado'],
      },
      {
        id: GRUPO_EXECUTOR,
        nome: 'Executor',
        diretiva: null,
        sistema: true,
        membros: [],
      },
    ],
    pedidos: [],
    links: [],
    estados: [],
    logs: [],
  }
}

function completar(store: Store): Store {
  if (!Array.isArray(store.links)) store.links = []
  const legado = store.usuarios as (Usuario & { executor?: boolean })[]
  if (!Array.isArray(store.membrosExecutor)) {
    store.membrosExecutor = legado.filter((item) => item.executor === true).map((item) => item.id)
  }
  for (const usuario of legado) {
    delete usuario.executor
    if (typeof usuario.ocultarBoasVindas !== 'boolean') usuario.ocultarBoasVindas = false
    const nomes = partirNome(usuario.nome)
    if (!usuario.primeiroNome) usuario.primeiroNome = nomes.primeiroNome
    if (usuario.sobrenome == null) usuario.sobrenome = nomes.sobrenome
    if (usuario.situacao !== 'ativa' && usuario.situacao !== 'bloqueada' && usuario.situacao !== 'desativada') {
      usuario.situacao = usuario.ativo ? 'ativa' : 'desativada'
    }
    usuario.ativo = usuario.situacao === 'ativa'
    if (usuario.ultimoAcessoEm === undefined) usuario.ultimoAcessoEm = null
    if (typeof usuario.sessaoGeracao !== 'number') usuario.sessaoGeracao = 0
  }
  const ids = new Set(store.usuarios.map((item) => item.id))
  store.membrosExecutor = [...new Set(store.membrosExecutor.filter((id) => ids.has(id)))]
  garantirGrupos(store, ids)
  for (const pedido of store.pedidos) {
    const nomes = partirNome(pedido.nome)
    if (!pedido.primeiroNome) pedido.primeiroNome = nomes.primeiroNome
    if (pedido.sobrenome == null) pedido.sobrenome = nomes.sobrenome
    if (pedido.papel !== 'administrador' && pedido.papel !== 'comum') pedido.papel = 'comum'
    if (pedido.grupoId === undefined) pedido.grupoId = null
    if (pedido.loginEscolhido === undefined) pedido.loginEscolhido = null
    if (typeof pedido.noExecutor !== 'boolean') pedido.noExecutor = false
  }
  return store
}

function grupoSistema(
  id: string,
  nome: string,
  diretiva: DiretivaGrupo | null,
): GrupoRegistro {
  return { id, nome, diretiva, sistema: true, membros: [] }
}

function garantirGrupos(store: Store, ids: Set<string>) {
  if (!Array.isArray(store.grupos)) store.grupos = []
  const vazio = store.grupos.length === 0
  const garantir = (id: string, nome: string, diretiva: DiretivaGrupo | null) => {
    let grupo = store.grupos.find((item) => item.id === id)
    if (!grupo) {
      grupo = grupoSistema(id, nome, diretiva)
      store.grupos.push(grupo)
    }
    grupo.nome = nome
    grupo.diretiva = diretiva
    grupo.sistema = true
    grupo.membros = [...new Set(grupo.membros.filter((membro) => ids.has(membro)))]
    return grupo
  }
  const administradores = garantir(GRUPO_ADMINISTRADORES, 'Administradores', 'administrador')
  const acessoComum = garantir(GRUPO_ACESSO_COMUM, 'Acesso comum', 'acesso_comum')
  const executor = garantir(GRUPO_EXECUTOR, 'Executor', null)
  if (vazio) {
    for (const usuario of store.usuarios) {
      if (usuario.papel === 'administrador') administradores.membros.push(usuario.id)
      else acessoComum.membros.push(usuario.id)
    }
    executor.membros = [...store.membrosExecutor]
  }
  for (const grupo of store.grupos) {
    if (grupo.sistema) continue
    grupo.membros = [...new Set(grupo.membros.filter((membro) => ids.has(membro)))]
    if (!grupo.diretiva) grupo.diretiva = 'acesso_comum'
  }
  store.membrosExecutor = [...executor.membros]
  for (const usuario of store.usuarios) {
    usuario.papel = papelDosGrupos(store.grupos, usuario.id)
  }
}

function definirGruposDoUsuario(store: Store, id: string, gruposIds: readonly string[]) {
  const escolhidos = new Set(gruposIds)
  for (const grupo of store.grupos) {
    const tem = grupo.membros.includes(id)
    const quer = escolhidos.has(grupo.id)
    if (quer && !tem) grupo.membros.push(id)
    if (!quer && tem) grupo.membros = grupo.membros.filter((membro) => membro !== id)
  }
  const executor = store.grupos.find((grupo) => grupo.id === GRUPO_EXECUTOR)
  store.membrosExecutor = executor ? [...executor.membros] : []
  const usuario = store.usuarios.find((item) => item.id === id)
  if (usuario) usuario.papel = papelDosGrupos(store.grupos, usuario.id)
}

function copiaGrupos(store: Store): GrupoRegistro[] {
  return store.grupos.map((grupo) => ({ ...grupo, membros: [...grupo.membros] }))
}

function restaurarGrupos(store: Store, grupos: GrupoRegistro[]) {
  store.grupos = grupos
  const executor = store.grupos.find((grupo) => grupo.id === GRUPO_EXECUTOR)
  store.membrosExecutor = executor ? [...executor.membros] : []
}

async function lerDisco(): Promise<Store | null> {
  try {
    const bruto = await readFile(ARQUIVO, 'utf8')
    return JSON.parse(bruto) as Store
  } catch {
    return null
  }
}

async function gravarDisco(store: Store) {
  await mkdir(path.dirname(ARQUIVO), { recursive: true })
  await writeFile(ARQUIVO, JSON.stringify(store, null, 2), { mode: 0o600 })
}

export function publico(usuario: Usuario, membros: readonly string[]): UsuarioPublico {
  const { senhaHash: _senha, ...resto } = usuario
  return { ...resto, noGrupoExecutor: membros.includes(usuario.id) }
}

export type EntradaLog = Omit<LogRegistro, 'id' | 'em'> & { em?: string }

function detalheSeguro(bruto: LogRegistro['detalhe']) {
  const detalhe: LogRegistro['detalhe'] = {}
  for (const [chave, valor] of Object.entries(bruto)) {
    if (/senha|token|secret|chave|hash/i.test(chave)) continue
    detalhe[chave] = valor
  }
  return detalhe
}

function montarLog(entrada: EntradaLog): LogRegistro {
  return {
    id: crypto.randomUUID(),
    em: entrada.em ?? new Date().toISOString(),
    nivel: entrada.nivel,
    evento: entrada.evento,
    ator: entrada.ator,
    mensagem: entrada.mensagem,
    detalhe: detalheSeguro(entrada.detalhe),
  }
}

function compararLog(a: LogRegistro, b: LogRegistro) {
  if (a.em < b.em) return -1
  if (a.em > b.em) return 1
  if (a.id < b.id) return -1
  if (a.id > b.id) return 1
  return 0
}

function recorteRecente(logs: LogRegistro[]) {
  if (logs.length <= LIMITE_LOGS) return logs
  const manter = new Set(
    [...logs].sort(compararLog).slice(-LIMITE_LOGS).map((item) => item.id),
  )
  return logs.filter((item) => manter.has(item.id))
}

function aplicarLimite(logs: LogRegistro[]) {
  if (logs.length <= LIMITE_LOGS) return
  const proximos = recorteRecente(logs)
  logs.length = 0
  logs.push(...proximos)
}

export function registrarNo(store: Store, entrada: EntradaLog) {
  store.logs.push(montarLog(entrada))
  aplicarLimite(store.logs)
}

function enfileirar<T>(fn: () => Promise<T>): Promise<T> {
  const exec = fila.then(fn)
  fila = exec.then(
    () => undefined,
    () => undefined,
  )
  return exec
}

/**
 * INSERT de um evento. No Supabase chama `registrar_log` (insere e mantém 300).
 * No JSON, a fila local lê e grava o arquivo; a regra de negócio não vê o conjunto.
 * Falha aqui é falha de auditoria: quem chama decide se a operação principal segue.
 */
export async function inserirLog(entrada: EntradaLog): Promise<void> {
  const registro = montarLog(entrada)
  if (supabaseConfigurado()) {
    await chamarFuncao<void>('registrar_log', {
      p_id: registro.id,
      p_em: registro.em,
      p_nivel: registro.nivel,
      p_evento: registro.evento,
      p_ator: registro.ator,
      p_mensagem: registro.mensagem,
      p_detalhe: registro.detalhe,
    })
    return
  }
  await enfileirar(async () => {
    const disco = await lerDisco()
    const store = disco ?? (await semear())
    if (!Array.isArray(store.logs)) store.logs = []
    store.logs.push(registro)
    aplicarLimite(store.logs)
    await gravarDisco(store)
  })
}

function textoDiagnostico(erro: unknown) {
  const bruto = erro instanceof Error ? erro.message : 'falha sem mensagem'
  return bruto
    .replace(/\s+/g, ' ')
    .replace(/senha|token|secret|hash|bearer|chave/gi, '[omitido]')
    .slice(0, 200)
}

/** A operação principal segue. A falha fica no log do processo, sem dado sensível. */
export async function registrarEvento(entrada: EntradaLog): Promise<void> {
  try {
    await inserirLog(entrada)
  } catch (erro) {
    const codigo =
      erro && typeof erro === 'object' && 'codigo' in erro && typeof erro.codigo === 'string'
        ? erro.codigo
        : ''
    const evento = entrada.evento.replace(/[^\w.-]/g, '').slice(0, 80) || 'desconhecido'
    console.error(
      `[auditoria] falha ao gravar ${evento}${codigo ? ` (${codigo})` : ''}: ${textoDiagnostico(erro)}`,
    )
  }
}

async function alterarLocal<T>(fn: (store: Store) => T | Promise<T>): Promise<T> {
  return enfileirar(async () => {
    const disco = await lerDisco()
    const store = disco ? completar(disco) : await semear()
    const resultado = await fn(store)
    await gravarDisco(store)
    return resultado
  })
}

export async function alterarStore<T>(fn: (store: Store) => T | Promise<T>): Promise<T> {
  return enfileirar(async () => {
    let store: Store
    if (supabaseConfigurado()) store = await lerNuvem()
    else {
      const disco = await lerDisco()
      store = disco ? completar(disco) : await semear()
    }
    const resultado = await fn(store)
    if (supabaseConfigurado()) await gravarNuvem(store)
    else await gravarDisco(store)
    return resultado
  })
}

/** Lê o arquivo local uma vez por requisição. Não é cache entre instâncias. */
const lerOperacaoLocal = cache(async (): Promise<Store> => {
  const disco = await lerDisco()
  if (disco) return completar(disco)
  return alterarStore((store) => store)
})

function idSeguro(id: string) {
  return /^[\w-]+$/.test(id)
}

const COLUNAS_USUARIO = [
  'id',
  'nome',
  'primeiro_nome',
  'sobrenome',
  'email',
  'celular',
  'login',
  'papel',
  'ativo',
  'situacao',
  'ultimo_acesso_em',
  'sessao_geracao',
  'origem',
  'ocultar_boas_vindas',
  'executor',
]
const OPCIONAIS_USUARIO = [
  'primeiro_nome',
  'sobrenome',
  'situacao',
  'ultimo_acesso_em',
  'sessao_geracao',
  'ocultar_boas_vindas',
  'executor',
]

type UsuarioPublicoRow = Omit<UsuarioRow, 'senha_hash'>

function situacaoDe(ativo: boolean, situacao: string | null | undefined): SituacaoConta {
  if (situacao === 'ativa' || situacao === 'bloqueada' || situacao === 'desativada') return situacao
  return ativo ? 'ativa' : 'desativada'
}

function usuarioPublicoDe(item: UsuarioPublicoRow, membros: ReadonlySet<string> | null): UsuarioPublico {
  const nomes = partirNome(item.nome)
  const situacao = situacaoDe(item.ativo, item.situacao)
  return {
    id: item.id,
    nome: item.nome,
    primeiroNome: item.primeiro_nome || nomes.primeiroNome,
    sobrenome: item.sobrenome ?? nomes.sobrenome,
    email: item.email,
    celular: item.celular,
    login: item.login,
    papel: item.papel,
    ativo: situacao === 'ativa',
    situacao,
    ultimoAcessoEm: item.ultimo_acesso_em ?? null,
    sessaoGeracao: typeof item.sessao_geracao === 'number' ? item.sessao_geracao : 0,
    origem: item.origem,
    ocultarBoasVindas: item.ocultar_boas_vindas === true,
    noGrupoExecutor: membros ? membros.has(item.id) : item.executor === true,
  }
}

async function lerColunas<T>(tabela: string, colunas: string[], opcionais: string[], filtro: string) {
  let atuais = [...colunas]
  for (;;) {
    try {
      return await lerTabela<T>(tabela, `select=${atuais.join(',')}&${filtro}`)
    } catch (erro) {
      const falta = colunaQueFalta(erro)
      if (!falta || !opcionais.includes(falta) || !atuais.includes(falta)) throw erro
      atuais = atuais.filter((coluna) => coluna !== falta)
    }
  }
}

const lerMembrosExecutorNuvem = cache(async (): Promise<ReadonlySet<string> | null> => {
  try {
    const linhas = await lerTabela<{ usuario_id: string }>(
      'grupo_membros',
      `select=usuario_id&grupo=eq.${GRUPO_EXECUTOR}`,
    )
    return new Set(linhas.map((item) => item.usuario_id))
  } catch (erro) {
    if (ehTabelaAusente(erro)) return null
    throw erro
  }
})

async function lerUsuariosPublicos(filtro: string) {
  const [linhas, membros] = await Promise.all([
    lerColunas<UsuarioPublicoRow>('usuarios', COLUNAS_USUARIO, OPCIONAIS_USUARIO, filtro),
    lerMembrosExecutorNuvem(),
  ])
  return linhas.map((item) => usuarioPublicoDe(item, membros))
}

const COLUNAS_LOGIN = ['id', 'login', 'senha_hash', 'papel', 'ativo', 'situacao', 'sessao_geracao', 'ocultar_boas_vindas']
const OPCIONAIS_LOGIN = ['situacao', 'sessao_geracao', 'ocultar_boas_vindas']

function usuarioLoginDe(item: UsuarioLoginRow): UsuarioLogin {
  const situacao = situacaoDe(item.ativo, item.situacao)
  return {
    id: item.id,
    login: item.login,
    senhaHash: item.senha_hash,
    papel: item.papel,
    ativo: situacao === 'ativa',
    situacao,
    sessaoGeracao: typeof item.sessao_geracao === 'number' ? item.sessao_geracao : 0,
    ocultarBoasVindas: item.ocultar_boas_vindas === true,
  }
}

async function lerUsuarioParaLogin(filtro: string) {
  const linhas = await lerColunas<UsuarioLoginRow>('usuarios', COLUNAS_LOGIN, OPCIONAIS_LOGIN, filtro)
  return linhas.map(usuarioLoginDe)
}

async function storeLocalParaLogin(): Promise<Store> {
  const disco = await lerDisco()
  if (disco) return completar(disco)
  return enfileirar(async () => {
    const deNovo = await lerDisco()
    if (deNovo) return completar(deNovo)
    const inicial = await semear()
    await gravarDisco(inicial)
    return inicial
  })
}

/** Uma linha, com senha_hash. No Supabase, leitura vazia não cria adm nem convidado. */
function loginConsulta(bruto: string) {
  const login = bruto.trim().toLowerCase()
  if (!login || login.length > 120 || /[\s/\\]/.test(login)) return null
  if (login.includes('@')) {
    return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(login) ? login : null
  }
  return /^[a-z0-9._-]{1,64}$/.test(login) ? login : null
}

export async function buscarUsuarioParaLogin(login: string): Promise<UsuarioLogin | null> {
  const normal = loginConsulta(login)
  if (!normal) return null
  if (!supabaseConfigurado()) {
    const store = await storeLocalParaLogin()
    const usuario = store.usuarios.find((item) => item.login === normal)
    if (!usuario) return null
    return {
      id: usuario.id,
      login: usuario.login,
      senhaHash: usuario.senhaHash,
      papel: usuario.papel,
      ativo: usuario.ativo,
      situacao: usuario.situacao,
      sessaoGeracao: usuario.sessaoGeracao,
      ocultarBoasVindas: usuario.ocultarBoasVindas,
    }
  }
  const lista = await lerUsuarioParaLogin(`${filtro('login', 'eq', normal)}&limit=1`)
  return lista[0] ?? null
}

export async function buscarUsuarioPublicoPorId(id: string): Promise<UsuarioPublico | null> {
  if (!idSeguro(id)) return null
  if (!supabaseConfigurado()) {
    const store = await lerOperacaoLocal()
    const usuario = store.usuarios.find((item) => item.id === id)
    return usuario ? publico(usuario, store.membrosExecutor) : null
  }
  const lista = await lerUsuariosPublicos(`id=eq.${id}&limit=1`)
  return lista[0] ?? null
}

export async function listarUsuariosPublicos(): Promise<UsuarioPublico[]> {
  if (!supabaseConfigurado()) {
    const store = await lerOperacaoLocal()
    return store.usuarios.map((item) => publico(item, store.membrosExecutor))
  }
  return lerUsuariosPublicos('order=login.asc')
}

export async function listarPedidos(): Promise<PedidoAcesso[]> {
  if (!supabaseConfigurado()) {
    const store = await lerOperacaoLocal()
    return store.pedidos
  }
  const linhas = await lerColunas<PedidoRow>(
    'pedidos_acesso',
    COLUNAS_PEDIDO,
    OPCIONAIS_PEDIDO,
    'order=criado_em.asc',
  )
  return linhas.map(pedidoDe)
}

export async function buscarPedidoPorId(id: string): Promise<PedidoAcesso | null> {
  if (!idSeguro(id)) return null
  if (!supabaseConfigurado()) {
    const store = await lerOperacaoLocal()
    return store.pedidos.find((item) => item.id === id) ?? null
  }
  const linhas = await lerColunas<PedidoRow>(
    'pedidos_acesso',
    COLUNAS_PEDIDO,
    OPCIONAIS_PEDIDO,
    `${filtro('id', 'eq', id)}&limit=1`,
  )
  return linhas[0] ? pedidoDe(linhas[0]) : null
}

function pedidoDe(item: PedidoRow): PedidoAcesso {
  const nomes = partirNome(item.nome)
  return {
    id: item.id,
    nome: item.nome,
    primeiroNome: item.primeiro_nome || nomes.primeiroNome,
    sobrenome: item.sobrenome ?? nomes.sobrenome,
    email: item.email,
    celular: item.celular,
    criadoEm: item.criado_em,
    situacao: item.situacao,
    decididoEm: item.decidido_em,
    decididoPor: item.decidido_por,
    papel: item.papel === 'administrador' ? 'administrador' : 'comum',
    grupoId: item.grupo_id ?? null,
    loginEscolhido: item.login_escolhido ?? null,
    noExecutor: item.no_executor === true,
  }
}

export async function listarLogs(): Promise<LogRegistro[]> {
  if (!supabaseConfigurado()) {
    const store = await lerOperacaoLocal()
    return recorteRecente(store.logs)
  }
  const linhas = await lerTabela<LogRow>(
    'logs',
    `select=id,em,nivel,evento,ator,mensagem,detalhe&order=em.desc&limit=${LIMITE_LOGS}`,
  )
  return linhas.reverse().map(logDe)
}

export async function listarAtoresComLogin(): Promise<Set<string>> {
  if (!supabaseConfigurado()) {
    const store = await lerOperacaoLocal()
    return new Set(
      recorteRecente(store.logs)
        .filter((item) => item.evento === 'USER_LOGIN' && item.ator)
        .map((item) => item.ator as string),
    )
  }
  const linhas = await lerTabela<{ evento: string; ator: string | null }>(
    'logs',
    `select=evento,ator&order=em.desc&limit=${LIMITE_LOGS}`,
  )
  return new Set(
    linhas.filter((item) => item.evento === 'USER_LOGIN' && item.ator).map((item) => item.ator as string),
  )
}

function logDe(item: LogRow): LogRegistro {
  return {
    id: item.id,
    em: item.em,
    nivel: item.nivel,
    evento: item.evento,
    ator: item.ator,
    mensagem: item.mensagem,
    detalhe: item.detalhe ?? {},
  }
}

export async function buscarLinkPorToken(token: string): Promise<LinkAcesso | null> {
  if (!tokenInformado(token)) return null
  if (!supabaseConfigurado()) {
    const store = await lerOperacaoLocal()
    return acharLink(store.links, token)
  }
  const hash = hashDoToken(token)
  try {
    const linhas = await lerTabela<LinkRow>(
      'links_acesso',
      `select=id,tipo,email,pedido_id,usuario_id,token_hash,criado_em,expira_em,usado_em&token_hash=eq.${hash}&limit=1`,
    )
    return linhas[0] ? linkDaLinha(linhas[0]) : null
  } catch (erro) {
    if (ehTabelaAusente(erro)) return null
    throw erro
  }
}

export async function listarEstadosEntrega(): Promise<EntregaEstadoRow[]> {
  if (!supabaseConfigurado()) {
    const store = await lerOperacaoLocal()
    return store.estados
  }
  return lerTabela<EntregaEstadoRow>('entrega_estados', 'select=entrega_id,status,posicao,atualizado_por,atualizado_em')
}

type UsuarioLoginRow = {
  id: string
  login: string
  senha_hash: string
  papel: Papel
  ativo: boolean
  situacao?: SituacaoConta | null
  sessao_geracao?: number | null
  ocultar_boas_vindas?: boolean | null
}

type UsuarioRow = {
  id: string
  nome: string
  primeiro_nome?: string | null
  sobrenome?: string | null
  email: string | null
  celular: string | null
  login: string
  senha_hash: string
  papel: Papel
  ativo: boolean
  situacao?: SituacaoConta | null
  ultimo_acesso_em?: string | null
  sessao_geracao?: number | null
  origem: Usuario['origem']
  ocultar_boas_vindas?: boolean | null
  executor?: boolean | null
}

const COLUNAS_PEDIDO = [
  'id',
  'nome',
  'primeiro_nome',
  'sobrenome',
  'email',
  'celular',
  'criado_em',
  'situacao',
  'decidido_em',
  'decidido_por',
  'papel',
  'grupo_id',
  'login_escolhido',
  'no_executor',
]
const OPCIONAIS_PEDIDO = ['primeiro_nome', 'sobrenome', 'papel', 'grupo_id', 'login_escolhido', 'no_executor']

type PedidoRow = {
  id: string
  nome: string
  primeiro_nome?: string | null
  sobrenome?: string | null
  email: string
  celular: string
  criado_em: string
  situacao: SituacaoPedido
  decidido_em: string | null
  decidido_por: string | null
  papel?: Papel | null
  grupo_id?: string | null
  login_escolhido?: string | null
  no_executor?: boolean | null
}

type LinkRow = {
  id: string
  tipo: TipoLink
  email: string
  pedido_id: string | null
  usuario_id: string | null
  token_hash: string
  criado_em: string
  expira_em: string
  usado_em: string | null
}

type LogRow = {
  id: string
  em: string
  nivel: NivelLog
  evento: string
  ator: string | null
  mensagem: string
  detalhe: LogRegistro['detalhe']
}

async function lerNuvem(): Promise<Store> {
  const [usuarios, pedidos, estados, logs, links, membros] = await Promise.all([
    lerTabela<UsuarioRow>('usuarios', 'select=*&order=login.asc'),
    lerTabela<PedidoRow>('pedidos_acesso', 'select=*&order=criado_em.asc'),
    lerTabela<EntregaEstadoRow>('entrega_estados', 'select=*'),
    lerTabela<LogRow>('logs', `select=*&order=em.desc&limit=${JANELA_REESCRITA_LOGS}`),
    lerLinks(),
    lerMembrosExecutorNuvem(),
  ])
  if (usuarios.length === 0) {
    const vazio = await semear()
    await gravarNuvem(vazio)
    return vazio
  }
  return {
    usuarios: usuarios.map((item) => {
      const publico = usuarioPublicoDe(item, membros)
      const { noGrupoExecutor: _grupo, ...conta } = publico
      return { ...conta, senhaHash: item.senha_hash }
    }),
    membrosExecutor: membros
      ? [...membros]
      : usuarios.filter((item) => item.executor === true).map((item) => item.id),
    grupos: [],
    pedidos: pedidos.map(pedidoDe),
    links,
    estados,
    logs: logs.reverse().map((item) => ({
      id: item.id,
      em: item.em,
      nivel: item.nivel,
      evento: item.evento,
      ator: item.ator,
      mensagem: item.mensagem,
      detalhe: item.detalhe ?? {},
    })),
  }
}

async function gravarNuvem(store: Store) {
  const temAdmin = store.usuarios.some((item) => item.papel === 'administrador' && item.ativo)
  if (!temAdmin) {
    throw new Error('A gravação foi recusada: ficaria sem administrador ativo.')
  }
  await gravarLinks(store.links)
  await gravarUsuarios(store.usuarios, store.membrosExecutor)
  await apagarFora(
    'usuarios',
    'id',
    store.usuarios.map((item) => item.id),
  )
  await gravarTabela(
    'pedidos_acesso',
    store.pedidos.map((item) => ({
      id: item.id,
      nome: item.nome,
      email: item.email,
      celular: item.celular,
      criado_em: item.criadoEm,
      situacao: item.situacao,
      decidido_em: item.decididoEm,
      decidido_por: item.decididoPor,
    })),
  )
  await apagarFora(
    'pedidos_acesso',
    'id',
    store.pedidos.map((item) => item.id),
  )
  await gravarTabela('entrega_estados', store.estados)
  await apagarFora(
    'entrega_estados',
    'entrega_id',
    store.estados.map((item) => item.entrega_id),
  )
  await gravarTabela(
    'logs',
    store.logs.map((item) => ({
      id: item.id,
      em: item.em,
      nivel: item.nivel,
      evento: item.evento,
      ator: item.ator,
      mensagem: item.mensagem,
      detalhe: item.detalhe,
    })),
  )
  await apagarFora(
    'logs',
    'id',
    store.logs.map((item) => item.id),
  )
}

async function gravarUsuarios(usuarios: Usuario[], membros: readonly string[]) {
  const linhas = usuarios.map((item) => ({
    id: item.id,
    nome: item.nome,
    email: item.email,
    celular: item.celular,
    login: item.login,
    senha_hash: item.senhaHash,
    papel: item.papel,
    ativo: item.ativo,
    origem: item.origem,
    ocultar_boas_vindas: item.ocultarBoasVindas,
  }))
  await escreverUsuarios(linhas, usuarios)
  try {
    await sincronizarGrupoExecutor(membros)
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro
    await escreverUsuarios(
      linhas.map((linha) => ({ ...linha, executor: membros.includes(String(linha.id)) })),
      usuarios,
      membros.length > 0,
    )
  }
}

async function escreverUsuarios(
  linhas: Record<string, unknown>[],
  usuarios: Usuario[],
  exigeExecutor = false,
) {
  let atuais = linhas
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    try {
      await gravarTabela('usuarios', atuais)
      return
    } catch (erro) {
      const falta = colunaQueFalta(erro)
      if (!falta) throw erro
      if (falta === 'ocultar_boas_vindas' && usuarios.some((item) => item.ocultarBoasVindas)) throw erro
      if (falta === 'executor' && exigeExecutor) throw erro
      if (falta !== 'ocultar_boas_vindas' && falta !== 'executor') throw erro
      atuais = atuais.map((linha) => {
        const copia = { ...linha }
        delete copia[falta]
        return copia
      })
    }
  }
  throw new Error('Não foi possível gravar as contas.')
}

async function sincronizarGrupoExecutor(membros: readonly string[]) {
  if (membros.length > 0) {
    await gravarTabela(
      'grupo_membros',
      membros.map((id) => ({ grupo: GRUPO_EXECUTOR, usuario_id: id })),
    )
  }
  await apagarFora('grupo_membros', 'usuario_id', [...membros])
}

async function lerLinks() {
  try {
    const linhas = await lerTabela<LinkRow>('links_acesso', 'select=*')
    return linhas.map(linkDaLinha)
  } catch (erro) {
    if (ehTabelaAusente(erro)) return []
    throw erro
  }
}

function linkDaLinha(item: LinkRow): LinkAcesso {
  return {
    id: item.id,
    tipo: item.tipo,
    email: item.email,
    pedidoId: item.pedido_id,
    usuarioId: item.usuario_id,
    tokenHash: item.token_hash,
    criadoEm: item.criado_em,
    expiraEm: item.expira_em,
    usadoEm: item.usado_em,
  }
}

async function gravarLinks(links: LinkAcesso[]) {
  try {
    if (links.length === 0) {
      await apagarFora('links_acesso', 'id', [])
      return
    }
    await gravarTabela(
      'links_acesso',
      links.map((item) => ({
        id: item.id,
        tipo: item.tipo,
        email: item.email,
        pedido_id: item.pedidoId,
        usuario_id: item.usuarioId,
        token_hash: item.tokenHash,
        criado_em: item.criadoEm,
        expira_em: item.expiraEm,
        usado_em: item.usadoEm,
      })),
    )
    await apagarFora(
      'links_acesso',
      'id',
      links.map((item) => item.id),
    )
  } catch (erro) {
    if (ehTabelaAusente(erro) && links.length === 0) return
    throw erro
  }
}

const EMAIL_EM_USO = 'Este e-mail já está em uma conta ou em um pedido pendente.'
const LOGIN_EM_USO = 'Este usuário já existe.'
const EMAIL_TEM_CONTA = 'Já existe uma conta com este e-mail.'
const PEDIDO_NAO_PENDENTE = 'Pedido não está pendente.'

function filtro(coluna: string, operador: 'eq' | 'gte' | 'ilike', valor: string) {
  if (!/^[a-z_]+$/.test(coluna)) throw new Error('Coluna inválida ao consultar o Supabase.')
  return `${coluna}=${operador}.${encodeURIComponent(valor)}`
}

function traduzirUnico(erro: unknown, frases: Record<string, string>) {
  const restricao = restricaoUnica(erro)
  if (!restricao) throw erro
  const frase = frases[restricao]
  if (!frase) throw erro
  return frase
}

async function existeLogin(login: string) {
  const lista = await lerUsuariosPublicos(`${filtro('login', 'eq', login)}&limit=1`)
  return lista.length > 0
}

async function existeEmailExato(email: string) {
  const lista = await lerUsuariosPublicos(`${filtro('email', 'eq', email)}&limit=1`)
  return lista.length > 0
}

function escaparLike(valor: string) {
  return valor.replace(/[\\%_]/g, (caractere) => `\\${caractere}`)
}

async function existeEmailNaConta(email: string, ignorarCaixa: boolean) {
  const lista = await lerUsuariosPublicos(`${filtro('email', 'ilike', escaparLike(email))}&limit=20`)
  return lista.some((item) => {
    if (item.email == null) return false
    if (ignorarCaixa) return item.email.toLowerCase() === email.toLowerCase()
    return item.email.toLowerCase() === email
  })
}

async function existePedidoPendente(email: string) {
  const linhas = await lerTabela<{ id: string }>(
    'pedidos_acesso',
    `select=id&${filtro('email', 'eq', email)}&situacao=eq.pendente&limit=1`,
  )
  return linhas.length > 0
}

async function idsAdministradoresAtivos() {
  const linhas = await lerTabela<{ id: string }>('usuarios', 'select=id&papel=eq.administrador&ativo=eq.true')
  return linhas.map((item) => item.id)
}

function sobraAdministrador(
  ids: string[],
  id: string,
  papel: Papel,
  ativo: boolean,
  removendo = false,
) {
  const era = ids.includes(id)
  const sera = !removendo && papel === 'administrador' && ativo
  return ids.length - (era ? 1 : 0) + (sera ? 1 : 0) > 0
}

async function inserirUsuarioNuvem(linha: Record<string, unknown>) {
  let atual = { ...linha }
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    try {
      await inserirLinha<{ id: string }>('usuarios', atual, 'id')
      return
    } catch (erro) {
      const coluna = colunaQueFalta(erro)
      if (!coluna || !(coluna in atual) || coluna === 'login' || coluna === 'senha_hash') throw erro
      delete atual[coluna]
      atual = { ...atual }
    }
  }
  throw new Error('Não foi possível criar a conta.')
}

async function emitirNaNuvem(entrada: {
  tipo: TipoLink
  email: string
  pedidoId: string | null
  usuarioId: string | null
}) {
  const agora = Date.now()
  await atualizarOnde<{ id: string }>(
    'links_acesso',
    `${filtro('tipo', 'eq', entrada.tipo)}&${filtro('email', 'eq', entrada.email)}&usado_em=is.null&select=id`,
    { usado_em: new Date(agora).toISOString() },
  )
  const { token, link } = criarLink(entrada, agora)
  await inserirLinha<{ id: string }>(
    'links_acesso',
    {
      id: link.id,
      tipo: link.tipo,
      email: link.email,
      pedido_id: link.pedidoId,
      usuario_id: link.usuarioId,
      token_hash: link.tokenHash,
      criado_em: link.criadoEm,
      expira_em: link.expiraEm,
      usado_em: null,
    },
    'id',
  )
  return token
}

async function marcarLinkNaNuvem(id: string) {
  const linhas = await atualizarOnde<{ id: string }>(
    'links_acesso',
    `${filtro('id', 'eq', id)}&usado_em=is.null&select=id`,
    { usado_em: new Date().toISOString() },
  )
  return linhas.length > 0
}

async function linkSenhaRecente(email: string) {
  const desde = new Date(Date.now() - INTERVALO_SENHA_MS).toISOString()
  const linhas = await lerTabela<{ id: string }>(
    'links_acesso',
    `select=id&tipo=eq.senha&${filtro('email', 'eq', email)}&usado_em=is.null&${filtro('criado_em', 'gte', desde)}&limit=1`,
  )
  return linhas.length > 0
}

export async function criarConta(
  entrada: {
    nome: string
    email: string | null
    celular: string | null
    login: string
    senha: string
    papel: Papel
  },
  ator: string,
) {
  const senhaHash = await hashSenha(entrada.senha)
  const erro = supabaseConfigurado()
    ? await criarContaNuvem(entrada, senhaHash)
    : await alterarLocal((store) => criarContaLocal(store, entrada, senhaHash))
  if (erro) return erro
  await registrarEvento({
    nivel: 'info',
    evento: 'USER_CREATED',
    ator,
    mensagem: `${ator} criou a conta ${entrada.login}.`,
    detalhe: { login: entrada.login, papel: entrada.papel },
  })
  return null
}

function criarContaLocal(
  store: Store,
  entrada: { nome: string; email: string | null; celular: string | null; login: string; papel: Papel },
  senhaHash: string,
) {
  if (store.usuarios.some((item) => item.login === entrada.login)) return LOGIN_EM_USO
  if (
    entrada.email &&
    (store.usuarios.some((item) => item.email === entrada.email) ||
      store.pedidos.some((item) => item.email === entrada.email && item.situacao === 'pendente'))
  ) {
    return EMAIL_EM_USO
  }
  const nomes = partirNome(entrada.nome)
  store.usuarios.push({
    id: crypto.randomUUID(),
    nome: entrada.nome,
    primeiroNome: nomes.primeiroNome,
    sobrenome: nomes.sobrenome,
    email: entrada.email,
    celular: entrada.celular,
    login: entrada.login,
    senhaHash,
    papel: entrada.papel,
    ativo: true,
    situacao: 'ativa',
    ultimoAcessoEm: null,
    sessaoGeracao: 0,
    origem: 'pedido',
    ocultarBoasVindas: false,
  })
  return null
}

async function criarContaNuvem(
  entrada: { nome: string; email: string | null; celular: string | null; login: string; papel: Papel },
  senhaHash: string,
) {
  if (await existeLogin(entrada.login)) return LOGIN_EM_USO
  if (entrada.email && ((await existeEmailExato(entrada.email)) || (await existePedidoPendente(entrada.email)))) {
    return EMAIL_EM_USO
  }
  try {
    await inserirUsuarioNuvem({
      id: crypto.randomUUID(),
      nome: entrada.nome,
      email: entrada.email,
      celular: entrada.celular,
      login: entrada.login,
      senha_hash: senhaHash,
      papel: entrada.papel,
      ativo: true,
      origem: 'pedido',
      ocultar_boas_vindas: false,
    })
  } catch (erro) {
    return traduzirUnico(erro, {
      usuarios_login_key: LOGIN_EM_USO,
      usuarios_email_unico: EMAIL_EM_USO,
    })
  }
  return null
}

export async function atualizarConta(
  id: string,
  entrada: {
    primeiroNome: string
    sobrenome: string
    celular: string | null
    situacao: SituacaoConta
    gruposIds: string[]
  },
  ator: string,
) {
  if (!idSeguro(id)) return 'Usuário não encontrado.'
  const resultado = supabaseConfigurado()
    ? await atualizarContaNuvem(id, entrada)
    : await alterarLocal((store) => atualizarContaLocal(store, id, entrada))
  if (resultado.erro) return resultado.erro
  await registrarEvento({
    nivel: 'info',
    evento: 'USER_UPDATED',
    ator,
    mensagem: `${ator} alterou ${resultado.login}.`,
    detalhe: { situacao: entrada.situacao, papel: resultado.papel },
  })
  return null
}

function atualizarContaLocal(
  store: Store,
  id: string,
  entrada: {
    primeiroNome: string
    sobrenome: string
    celular: string | null
    situacao: SituacaoConta
    gruposIds: string[]
  },
) {
  const usuario = store.usuarios.find((item) => item.id === id)
  if (!usuario) return { erro: 'Usuário não encontrado.', login: '', papel: 'comum' as Papel }
  const conhecidos = new Set(store.grupos.map((grupo) => grupo.id))
  if (entrada.gruposIds.some((grupoId) => !conhecidos.has(grupoId))) {
    return { erro: 'Grupo não encontrado.', login: '', papel: 'comum' as Papel }
  }
  const comDiretiva = store.grupos.filter(
    (grupo) => entrada.gruposIds.includes(grupo.id) && grupo.diretiva,
  )
  if (comDiretiva.length === 0) {
    return { erro: 'A conta precisa de um grupo com diretiva.', login: '', papel: 'comum' as Papel }
  }
  const gruposAntes = copiaGrupos(store)
  const papelAntes = usuario.papel
  const situacaoAntes = usuario.situacao
  definirGruposDoUsuario(store, id, entrada.gruposIds)
  const ativa = entrada.situacao === 'ativa'
  usuario.situacao = entrada.situacao
  usuario.ativo = ativa
  const sobra = store.usuarios.some((item) => item.papel === 'administrador' && item.situacao === 'ativa')
  if (!sobra) {
    restaurarGrupos(store, gruposAntes)
    usuario.papel = papelAntes
    usuario.situacao = situacaoAntes
    usuario.ativo = situacaoAntes === 'ativa'
    return {
      erro: 'O único administrador ativo não pode ser bloqueado, desativado nem rebaixado.',
      login: '',
      papel: 'comum' as Papel,
    }
  }
  usuario.primeiroNome = entrada.primeiroNome
  usuario.sobrenome = entrada.sobrenome
  usuario.nome = nomeCompleto(entrada.primeiroNome, entrada.sobrenome)
  usuario.celular = entrada.celular
  if (!ativa) usuario.sessaoGeracao += 1
  return { erro: null, login: usuario.login, papel: usuario.papel }
}

function definirMembroLocal(store: Store, id: string, incluir: boolean) {
  const executor = store.grupos.find((grupo) => grupo.id === GRUPO_EXECUTOR)
  if (!executor) {
    const tem = store.membrosExecutor.includes(id)
    if (incluir && !tem) store.membrosExecutor.push(id)
    if (!incluir && tem) store.membrosExecutor = store.membrosExecutor.filter((item) => item !== id)
    return
  }
  const tem = executor.membros.includes(id)
  if (incluir && !tem) executor.membros.push(id)
  if (!incluir && tem) executor.membros = executor.membros.filter((item) => item !== id)
  store.membrosExecutor = [...executor.membros]
}

async function atualizarContaNuvem(
  id: string,
  entrada: {
    primeiroNome: string
    sobrenome: string
    celular: string | null
    situacao: SituacaoConta
    gruposIds: string[]
  },
) {
  const usuario = await buscarUsuarioPublicoPorId(id)
  if (!usuario) return { erro: 'Usuário não encontrado.', login: '', papel: 'comum' as Papel }
  const grupos = await listarGrupos()
  const conhecidos = new Set(grupos.map((grupo) => grupo.id))
  if (entrada.gruposIds.some((grupoId) => !conhecidos.has(grupoId))) {
    return { erro: 'Grupo não encontrado.', login: '', papel: 'comum' as Papel }
  }
  const escolhidos = grupos.filter((grupo) => entrada.gruposIds.includes(grupo.id))
  if (!escolhidos.some((grupo) => grupo.diretiva)) {
    return { erro: 'A conta precisa de um grupo com diretiva.', login: '', papel: 'comum' as Papel }
  }
  const papel: Papel = escolhidos.some((grupo) => grupo.diretiva === 'administrador')
    ? 'administrador'
    : 'comum'
  const ids = await idsAdministradoresAtivos()
  const ativa = entrada.situacao === 'ativa'
  if (!sobraAdministrador(ids, id, papel, ativa)) {
    return {
      erro: 'O único administrador ativo não pode ser bloqueado, desativado nem rebaixado.',
      login: '',
      papel: 'comum' as Papel,
    }
  }
  const corpo: Record<string, unknown> = {
    nome: nomeCompleto(entrada.primeiroNome, entrada.sobrenome),
    primeiro_nome: entrada.primeiroNome,
    sobrenome: entrada.sobrenome,
    celular: entrada.celular,
    papel,
    ativo: ativa,
    situacao: entrada.situacao,
  }
  if (!ativa) corpo.sessao_geracao = usuario.sessaoGeracao + 1
  await gravarConta(id, corpo)
  const erroGrupo = await gravarMembrosNuvem(id, entrada.gruposIds)
  if (erroGrupo) return { erro: erroGrupo, login: '', papel: 'comum' as Papel }
  return { erro: null, login: usuario.login, papel }
}

async function definirMembroExecutorNuvem(id: string, incluir: boolean) {
  try {
    if (incluir) {
      await gravarTabela('grupo_membros', [{ grupo: GRUPO_EXECUTOR, usuario_id: id }])
      return
    }
    await apagarOnde('grupo_membros', `${filtro('grupo', 'eq', GRUPO_EXECUTOR)}&${filtro('usuario_id', 'eq', id)}`)
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro
    const linhas = await atualizarOnde<{ id: string }>(
      'usuarios',
      `${filtro('id', 'eq', id)}&select=id`,
      { executor: incluir },
    )
    if (linhas.length === 0) throw new Error('Usuário não encontrado.')
  }
}

async function gravarConta(id: string, corpo: Record<string, unknown>) {
  let atual = { ...corpo }
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    try {
      const linhas = await atualizarOnde<{ id: string }>(
        'usuarios',
        `${filtro('id', 'eq', id)}&select=id`,
        atual,
      )
      if (linhas.length === 0) throw new Error('Usuário não encontrado.')
      return
    } catch (erro) {
      const coluna = colunaQueFalta(erro)
      if (!coluna || !(coluna in atual)) throw erro
      delete atual[coluna]
      atual = { ...atual }
    }
  }
  throw new Error('Usuário não encontrado.')
}

export async function trocarSenhaDaConta(id: string, senha: string, ator: string) {
  if (!idSeguro(id)) return 'Usuário não encontrado.'
  const senhaHash = await hashSenha(senha)
  const login = supabaseConfigurado()
    ? await trocarSenhaNuvem(id, senhaHash)
    : await alterarLocal((store) => trocarSenhaLocal(store, id, senhaHash))
  if (!login.ok) return login.erro
  await registrarEvento({
    nivel: 'info',
    evento: 'USER_PASSWORD_CHANGED',
    ator,
    mensagem: `${ator} definiu uma senha nova para ${login.login}.`,
    detalhe: { login: login.login },
  })
  return null
}

function trocarSenhaLocal(store: Store, id: string, senhaHash: string) {
  const usuario = store.usuarios.find((item) => item.id === id)
  if (!usuario) return { ok: false as const, erro: 'Usuário não encontrado.' }
  usuario.senhaHash = senhaHash
  return { ok: true as const, login: usuario.login, erro: null }
}

async function trocarSenhaNuvem(id: string, senhaHash: string) {
  const usuario = await buscarUsuarioPublicoPorId(id)
  if (!usuario) return { ok: false as const, erro: 'Usuário não encontrado.' }
  const linhas = await atualizarOnde<{ id: string }>('usuarios', `${filtro('id', 'eq', id)}&select=id`, {
    senha_hash: senhaHash,
  })
  if (linhas.length === 0) return { ok: false as const, erro: 'Usuário não encontrado.' }
  return { ok: true as const, login: usuario.login, erro: null }
}

export async function excluirConta(id: string, ator: string) {
  if (!idSeguro(id)) return { erro: 'Usuário não encontrado.', login: '' }
  const resultado = supabaseConfigurado()
    ? await excluirContaNuvem(id)
    : await alterarLocal((store) => excluirContaLocal(store, id))
  if (resultado.erro || !resultado.login) return { erro: resultado.erro ?? 'Usuário não encontrado.', login: '' }
  if (!supabaseConfigurado()) {
    await tirarParticipanteLocal(id)
    await tirarResponsavelLocal(id)
  }
  await registrarEvento({
    nivel: 'info',
    evento: 'USER_DELETED',
    ator,
    mensagem: `${ator} excluiu a conta ${resultado.login}.`,
    detalhe: { login: resultado.login },
  })
  return { erro: null, login: resultado.login }
}

function excluirContaLocal(store: Store, id: string) {
  const usuario = store.usuarios.find((item) => item.id === id)
  if (!usuario) return { erro: 'Usuário não encontrado.', login: '' }
  const ids = store.usuarios.filter((item) => item.papel === 'administrador' && item.ativo).map((item) => item.id)
  if (!sobraAdministrador(ids, id, usuario.papel, false, true)) {
    return { erro: 'O único administrador ativo não pode ser excluído.', login: '' }
  }
  store.usuarios = store.usuarios.filter((item) => item.id !== id)
  for (const grupo of store.grupos) {
    grupo.membros = grupo.membros.filter((membro) => membro !== id)
  }
  store.membrosExecutor = store.grupos.find((grupo) => grupo.id === GRUPO_EXECUTOR)?.membros.slice() ?? []
  return { erro: null, login: usuario.login }
}

async function excluirContaNuvem(id: string) {
  const usuario = await buscarUsuarioPublicoPorId(id)
  if (!usuario) return { erro: 'Usuário não encontrado.', login: '' }
  const ids = await idsAdministradoresAtivos()
  if (!sobraAdministrador(ids, id, usuario.papel, false, true)) {
    return { erro: 'O único administrador ativo não pode ser excluído.', login: '' }
  }
  const linhas = await apagarOnde<{ id: string }>('usuarios', `${filtro('id', 'eq', id)}&select=id`)
  if (linhas.length === 0) return { erro: 'Usuário não encontrado.', login: '' }
  return { erro: null, login: usuario.login }
}

export async function registrarPedido(entrada: {
  primeiroNome: string
  sobrenome: string
  email: string
  celular: string
}) {
  const erro = supabaseConfigurado()
    ? await registrarPedidoNuvem(entrada)
    : await alterarLocal((store) => registrarPedidoLocal(store, entrada))
  if (erro) return erro
  await registrarEvento({
    nivel: 'info',
    evento: 'USER_SIGNUP_REQUESTED',
    ator: null,
    mensagem: `${nomeCompleto(entrada.primeiroNome, entrada.sobrenome)} pediu acesso.`,
    detalhe: { email: entrada.email },
  })
  return null
}

function registrarPedidoLocal(
  store: Store,
  entrada: { primeiroNome: string; sobrenome: string; email: string; celular: string },
) {
  if (store.usuarios.some((item) => item.email === entrada.email || item.login === entrada.email)) {
    return EMAIL_TEM_CONTA
  }
  if (store.pedidos.some((item) => item.email === entrada.email && item.situacao === 'pendente')) {
    return EMAIL_EM_USO
  }
  store.pedidos.push({
    id: crypto.randomUUID(),
    nome: nomeCompleto(entrada.primeiroNome, entrada.sobrenome),
    primeiroNome: entrada.primeiroNome,
    sobrenome: entrada.sobrenome,
    email: entrada.email,
    celular: entrada.celular,
    criadoEm: new Date().toISOString(),
    situacao: 'pendente',
    decididoEm: null,
    decididoPor: null,
    papel: 'comum',
    grupoId: GRUPO_ACESSO_COMUM,
    loginEscolhido: null,
    noExecutor: false,
  })
  return null
}

async function registrarPedidoNuvem(entrada: {
  primeiroNome: string
  sobrenome: string
  email: string
  celular: string
}) {
  if ((await existeEmailExato(entrada.email)) || (await existeLogin(entrada.email))) return EMAIL_TEM_CONTA
  if (await existePedidoPendente(entrada.email)) return EMAIL_EM_USO
  try {
    await inserirPedido({
      nome: nomeCompleto(entrada.primeiroNome, entrada.sobrenome),
      primeiro_nome: entrada.primeiroNome,
      sobrenome: entrada.sobrenome,
      email: entrada.email,
      celular: entrada.celular,
      situacao: 'pendente',
      papel: 'comum',
      decidido_em: null,
      decidido_por: null,
    })
  } catch (erro) {
    return traduzirUnico(erro, { pedidos_acesso_email_pendente: EMAIL_EM_USO })
  }
  return null
}

async function inserirPedido(corpo: Record<string, unknown>) {
  let atual: Record<string, unknown> = {
    id: crypto.randomUUID(),
    criado_em: new Date().toISOString(),
    ...corpo,
  }
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    try {
      await inserirLinha<{ id: string }>('pedidos_acesso', atual, 'id')
      return
    } catch (erro) {
      const coluna = colunaQueFalta(erro)
      if (!coluna || !(coluna in atual) || coluna === 'nome' || coluna === 'email') throw erro
      delete atual[coluna]
      atual = { ...atual }
    }
  }
  throw new Error('Não foi possível gravar o pedido.')
}

export async function decidirPedidoOperacao(id: string, acao: 'aprovar' | 'rejeitar', ator: string) {
  const vazio = { erro: PEDIDO_NAO_PENDENTE, email: '', nome: '', token: '' }
  if (!idSeguro(id)) return vazio
  const resultado = supabaseConfigurado()
    ? await decidirPedidoNuvem(id, acao, ator)
    : await alterarLocal((store) => decidirPedidoLocal(store, id, acao, ator))
  if (resultado.erro) return resultado
  await registrarEvento({
    nivel: 'info',
    evento: acao === 'aprovar' ? 'USER_APPROVED' : 'USER_REJECTED',
    ator,
    mensagem:
      acao === 'aprovar'
        ? `${ator} aprovou o pedido de ${resultado.nome}. O link de confirmação segue para o e-mail.`
        : `${ator} rejeitou o pedido de ${resultado.nome}.`,
    detalhe: { email: resultado.email },
  })
  return resultado
}

function decidirPedidoLocal(store: Store, id: string, acao: 'aprovar' | 'rejeitar', ator: string) {
  const pedido = store.pedidos.find((item) => item.id === id)
  if (!pedido || pedido.situacao !== 'pendente') {
    return { erro: PEDIDO_NAO_PENDENTE, email: '', nome: '', token: '' }
  }
  if (
    acao === 'aprovar' &&
    store.usuarios.some((item) => item.email != null && item.email.toLowerCase() === pedido.email)
  ) {
    return { erro: EMAIL_TEM_CONTA, email: '', nome: '', token: '' }
  }
  pedido.situacao = acao === 'aprovar' ? 'aprovado' : 'rejeitado'
  pedido.decididoEm = new Date().toISOString()
  pedido.decididoPor = ator
  const token =
    acao === 'aprovar'
      ? emitirLink(store.links, {
          tipo: 'confirmacao',
          email: pedido.email,
          pedidoId: pedido.id,
          usuarioId: null,
        })
      : ''
  return { erro: null, email: pedido.email, nome: pedido.nome, token }
}

async function decidirPedidoNuvem(id: string, acao: 'aprovar' | 'rejeitar', ator: string) {
  const pedido = await buscarPedidoPorId(id)
  if (!pedido || pedido.situacao !== 'pendente') {
    return { erro: PEDIDO_NAO_PENDENTE, email: '', nome: '', token: '' }
  }
  if (acao === 'aprovar' && (await existeEmailNaConta(pedido.email, false))) {
    return { erro: EMAIL_TEM_CONTA, email: '', nome: '', token: '' }
  }
  const linhas = await atualizarOnde<PedidoRow>(
    'pedidos_acesso',
    `${filtro('id', 'eq', id)}&situacao=eq.pendente&select=id,nome,email,celular,criado_em,situacao,decidido_em,decidido_por`,
    {
      situacao: acao === 'aprovar' ? 'aprovado' : 'rejeitado',
      decidido_em: new Date().toISOString(),
      decidido_por: ator,
    },
  )
  if (linhas.length === 0) return { erro: PEDIDO_NAO_PENDENTE, email: '', nome: '', token: '' }
  const gravado = pedidoDe(linhas[0])
  if (acao !== 'aprovar') return { erro: null, email: gravado.email, nome: gravado.nome, token: '' }
  try {
    const token = await emitirNaNuvem({
      tipo: 'confirmacao',
      email: gravado.email,
      pedidoId: gravado.id,
      usuarioId: null,
    })
    return { erro: null, email: gravado.email, nome: gravado.nome, token }
  } catch (erro) {
    console.error(`[pedido] falha ao gerar link depois da aprovação: ${textoDiagnostico(erro)}`)
    await registrarEvento({
      nivel: 'alerta',
      evento: 'USER_APPROVED',
      ator,
      mensagem: `${ator} aprovou o pedido de ${gravado.nome}. O link de confirmação não foi gerado.`,
      detalhe: { email: gravado.email },
    })
    return {
      erro: 'Pedido aprovado. O link não foi gerado. Reenvie a notificação.',
      email: gravado.email,
      nome: gravado.nome,
      token: '',
    }
  }
}

export async function reenviarConvite(id: string, ator: string) {
  if (!idSeguro(id)) return { erro: 'Só dá para reenviar um pedido aprovado.', email: '', nome: '', token: '' }
  const resultado = supabaseConfigurado()
    ? await reenviarConviteNuvem(id)
    : await alterarLocal((store) => reenviarConviteLocal(store, id))
  if (resultado.erro) return resultado
  await registrarEvento({
    nivel: 'info',
    evento: 'USER_NOTIFY_RESEND',
    ator,
    mensagem: `${ator} reenviou a confirmação para ${resultado.email}.`,
    detalhe: { email: resultado.email },
  })
  return resultado
}

function reenviarConviteLocal(store: Store, id: string) {
  const pedido = store.pedidos.find((item) => item.id === id)
  if (!pedido || pedido.situacao !== 'aprovado') {
    return { erro: 'Só dá para reenviar um pedido aprovado.', email: '', nome: '', token: '' }
  }
  const usuario = store.usuarios.find(
    (item) => item.email != null && item.email.toLowerCase() === pedido.email.toLowerCase(),
  )
  if (usuario) {
    return { erro: 'A conta deste e-mail já existe. O reenvio não cria outra.', email: '', nome: '', token: '' }
  }
  const token = emitirLink(store.links, {
    tipo: 'confirmacao',
    email: pedido.email,
    pedidoId: pedido.id,
    usuarioId: null,
  })
  return { erro: null, email: pedido.email, nome: pedido.nome, token }
}

async function reenviarConviteNuvem(id: string) {
  const pedido = await buscarPedidoPorId(id)
  if (!pedido || pedido.situacao !== 'aprovado') {
    return { erro: 'Só dá para reenviar um pedido aprovado.', email: '', nome: '', token: '' }
  }
  if (await existeEmailNaConta(pedido.email, true)) {
    return { erro: 'A conta deste e-mail já existe. O reenvio não cria outra.', email: '', nome: '', token: '' }
  }
  const token = await emitirNaNuvem({
    tipo: 'confirmacao',
    email: pedido.email,
    pedidoId: pedido.id,
    usuarioId: null,
  })
  return { erro: null, email: pedido.email, nome: pedido.nome, token }
}

export async function prepararRecuperacao(email: string) {
  await registrarEvento({
    nivel: 'info',
    evento: 'PASSWORD_RECOVERY_REQUESTED',
    ator: null,
    mensagem: 'Alguém pediu recuperação de senha.',
    detalhe: { email },
  })
  if (!supabaseConfigurado()) {
    return alterarLocal((store) => prepararRecuperacaoLocal(store, email))
  }
  const lista = await lerUsuariosPublicos(`${filtro('email', 'eq', email)}&limit=1`)
  const usuario = lista[0]
  if (!usuario?.ativo || (await linkSenhaRecente(email))) return ''
  return emitirNaNuvem({ tipo: 'senha', email, pedidoId: null, usuarioId: usuario.id })
}

function prepararRecuperacaoLocal(store: Store, email: string) {
  const usuario = store.usuarios.find((item) => item.email === email && item.ativo)
  if (!usuario || linkRecente(store.links, 'senha', email)) return ''
  return emitirLink(store.links, {
    tipo: 'senha',
    email,
    pedidoId: null,
    usuarioId: usuario.id,
  })
}

export async function confirmarConta(entrada: { token: string; senha: string }) {
  const resultado = supabaseConfigurado()
    ? await confirmarContaNuvem(entrada)
    : await confirmarContaLocal(entrada)
  if (resultado.erro) return resultado
  await registrarEvento({
    nivel: 'info',
    evento: 'USER_CONFIRMED',
    ator: resultado.login,
    mensagem: `${resultado.login} confirmou o acesso.`,
    detalhe: { email: resultado.email },
  })
  await registrarEvento({
    nivel: 'info',
    evento: 'USER_LOGIN',
    ator: resultado.login,
    mensagem: `${resultado.login} entrou.`,
    detalhe: { papel: resultado.papel },
  })
  return resultado
}

async function confirmarContaLocal(entrada: { token: string; senha: string }) {
  const senhaHash = await hashSenha(entrada.senha)
  return alterarLocal((store) => {
    const link = acharLink(store.links, entrada.token)
    const motivo = motivoDoLink(link, 'confirmacao')
    if (motivo || !link) {
      return { erro: motivo ?? 'Este link não vale.', usuarioId: '', login: '', email: '', papel: 'comum' as const }
    }
    const pedido = store.pedidos.find((item) => item.id === link.pedidoId)
    if (!pedido || pedido.situacao !== 'aprovado') {
      return { erro: 'Este pedido não está aprovado.', usuarioId: '', login: '', email: '', papel: 'comum' as const }
    }
    const login = (pedido.loginEscolhido || link.email).trim().toLowerCase()
    if (store.usuarios.some((item) => item.login === login || item.email === link.email)) {
      return { erro: EMAIL_TEM_CONTA, usuarioId: '', login: '', email: '', papel: 'comum' as const }
    }
    const usuarioId = crypto.randomUUID()
    const pedidoGrupo = pedido.grupoId || GRUPO_ACESSO_COMUM
    const grupoId = store.grupos.some((grupo) => grupo.id === pedidoGrupo && grupo.diretiva)
      ? pedidoGrupo
      : GRUPO_ACESSO_COMUM
    store.usuarios.push({
      id: usuarioId,
      nome: nomeCompleto(pedido.primeiroNome, pedido.sobrenome) || pedido.nome,
      primeiroNome: pedido.primeiroNome,
      sobrenome: pedido.sobrenome,
      email: link.email,
      celular: pedido.celular,
      login,
      senhaHash,
      papel: 'comum',
      ativo: true,
      situacao: 'ativa',
      ultimoAcessoEm: null,
      sessaoGeracao: 0,
      origem: 'pedido',
      ocultarBoasVindas: false,
    })
    const gruposIds = [grupoId]
    if (pedido.noExecutor) gruposIds.push(GRUPO_EXECUTOR)
    definirGruposDoUsuario(store, usuarioId, gruposIds)
    const criado = store.usuarios.find((item) => item.id === usuarioId)
    link.usadoEm = new Date().toISOString()
    return { erro: null, usuarioId, login, email: link.email, papel: criado?.papel ?? 'comum' }
  })
}

async function confirmarContaNuvem(entrada: { token: string; senha: string }) {
  const link = await buscarLinkPorToken(entrada.token)
  const motivo = motivoDoLink(link, 'confirmacao')
  if (motivo || !link) return { erro: motivo ?? 'Este link não vale.', usuarioId: '', login: '', email: '', papel: 'comum' as const }
  if (!link.pedidoId) return { erro: 'Este pedido não está aprovado.', usuarioId: '', login: '', email: '', papel: 'comum' as const }
  const pedido = await buscarPedidoPorId(link.pedidoId)
  if (!pedido || pedido.situacao !== 'aprovado') {
    return { erro: 'Este pedido não está aprovado.', usuarioId: '', login: '', email: '', papel: 'comum' as const }
  }
  const login = (pedido.loginEscolhido || link.email).trim().toLowerCase()
  if ((await existeLogin(login)) || (await existeEmailExato(link.email)) || (await existeLogin(link.email))) {
    return { erro: EMAIL_TEM_CONTA, usuarioId: '', login: '', email: '', papel: 'comum' as const }
  }
  const usuarioId = crypto.randomUUID()
  const senhaHash = await hashSenha(entrada.senha)
  const papel = pedido.papel === 'administrador' ? 'administrador' : 'comum'
  try {
    await inserirUsuarioNuvem({
      id: usuarioId,
      nome: nomeCompleto(pedido.primeiroNome, pedido.sobrenome) || pedido.nome,
      primeiro_nome: pedido.primeiroNome,
      sobrenome: pedido.sobrenome,
      email: link.email,
      celular: pedido.celular,
      login,
      senha_hash: senhaHash,
      papel,
      ativo: true,
      situacao: 'ativa',
      sessao_geracao: 0,
      origem: 'pedido',
      ocultar_boas_vindas: false,
    })
  } catch (erro) {
    return {
      erro: traduzirUnico(erro, {
        usuarios_login_key: EMAIL_TEM_CONTA,
        usuarios_email_unico: EMAIL_TEM_CONTA,
      }),
      usuarioId: '',
      login: '',
      email: '',
      papel: 'comum' as const,
    }
  }
  const grupoId = pedido.grupoId || (papel === 'administrador' ? GRUPO_ADMINISTRADORES : GRUPO_ACESSO_COMUM)
  const gruposIds = [grupoId]
  if (pedido.noExecutor) gruposIds.push(GRUPO_EXECUTOR)
  try {
    await gravarMembrosNuvem(usuarioId, gruposIds)
  } catch (erro) {
    console.error(`[auditoria] falha ao incluir a conta no grupo: ${textoDiagnostico(erro)}`)
  }
  try {
    await marcarLinkNaNuvem(link.id)
  } catch (erro) {
    console.error(`[auditoria] falha ao marcar link de confirmação: ${textoDiagnostico(erro)}`)
  }
  return { erro: null, usuarioId, login, email: link.email, papel }
}

export async function trocarSenhaPeloLink(token: string, senha: string) {
  const resultado = supabaseConfigurado()
    ? await trocarSenhaPeloLinkNuvem(token, senha)
    : await trocarSenhaPeloLinkLocal(token, senha)
  if (resultado.erro) return resultado.erro
  await registrarEvento({
    nivel: 'info',
    evento: 'USER_PASSWORD_CHANGED',
    ator: resultado.login,
    mensagem: `${resultado.login} definiu uma senha nova pelo link.`,
    detalhe: { login: resultado.login },
  })
  return null
}

async function trocarSenhaPeloLinkLocal(token: string, senha: string) {
  const senhaHash = await hashSenha(senha)
  return alterarLocal((store) => {
    const link = acharLink(store.links, token)
    const motivo = motivoDoLink(link, 'senha')
    if (motivo || !link) return { erro: motivo ?? 'Este link não vale.', login: '' }
    const usuario = store.usuarios.find((item) => item.id === link.usuarioId && item.email === link.email)
    if (!usuario || !usuario.ativo) {
      return { erro: 'Esta conta não pode trocar a senha por este link.', login: '' }
    }
    usuario.senhaHash = senhaHash
    usuario.sessaoGeracao += 1
    link.usadoEm = new Date().toISOString()
    return { erro: null, login: usuario.login }
  })
}

async function trocarSenhaPeloLinkNuvem(token: string, senha: string) {
  const link = await buscarLinkPorToken(token)
  const motivo = motivoDoLink(link, 'senha')
  if (motivo || !link) return { erro: motivo ?? 'Este link não vale.', login: '' }
  if (!link.usuarioId) return { erro: 'Esta conta não pode trocar a senha por este link.', login: '' }
  const usuario = await buscarUsuarioPublicoPorId(link.usuarioId)
  if (!usuario || !usuario.ativo || usuario.email !== link.email) {
    return { erro: 'Esta conta não pode trocar a senha por este link.', login: '' }
  }
  const marcado = await marcarLinkNaNuvem(link.id)
  if (!marcado) return { erro: 'Este link já foi usado.', login: '' }
  const senhaHash = await hashSenha(senha)
  try {
    await gravarConta(usuario.id, {
      senha_hash: senhaHash,
      sessao_geracao: usuario.sessaoGeracao + 1,
    })
  } catch (erro) {
    console.error(`[senha] falha ao gravar depois de consumir o link: ${textoDiagnostico(erro)}`)
    return { erro: 'Não foi possível gravar a senha. Peça um link novo.', login: '' }
  }
  return { erro: null, login: usuario.login }
}

export async function marcarUltimoAcesso(id: string) {
  if (!idSeguro(id)) return
  const agora = new Date().toISOString()
  try {
    if (!supabaseConfigurado()) {
      await alterarLocal((store) => {
        const usuario = store.usuarios.find((item) => item.id === id)
        if (usuario) usuario.ultimoAcessoEm = agora
      })
      return
    }
    await atualizarOnde<{ id: string }>('usuarios', `${filtro('id', 'eq', id)}&select=id`, {
      ultimo_acesso_em: agora,
    })
  } catch (erro) {
    if (colunaQueFalta(erro) === 'ultimo_acesso_em') return
    console.error(`[login] não foi possível gravar o último acesso: ${textoDiagnostico(erro)}`)
  }
}

export async function convidarConta(
  entrada: {
    primeiroNome: string
    sobrenome: string
    email: string
    celular: string
    login: string
    grupoId: string
    noExecutor: boolean
  },
  ator: string,
) {
  const nome = nomeCompleto(entrada.primeiroNome, entrada.sobrenome)
  const resultado = supabaseConfigurado()
    ? await convidarNuvem(entrada, nome, ator)
    : await alterarLocal((store) => convidarLocal(store, entrada, nome, ator))
  if (resultado.erro) return resultado
  await registrarEvento({
    nivel: 'info',
    evento: 'USER_APPROVED',
    ator,
    mensagem: `${ator} convidou ${entrada.email}.`,
    detalhe: { email: entrada.email, login: entrada.login, grupo: entrada.grupoId },
  })
  return resultado
}

function convidarLocal(
  store: Store,
  entrada: {
    primeiroNome: string
    sobrenome: string
    email: string
    celular: string
    login: string
    grupoId: string
    noExecutor: boolean
  },
  nome: string,
  ator: string,
) {
  const grupo = store.grupos.find((item) => item.id === entrada.grupoId && item.diretiva)
  if (!grupo) return { erro: 'Escolha um grupo que já tenha diretiva.', email: '', nome: '', token: '' }
  if (
    store.usuarios.some(
      (item) => item.email === entrada.email || item.login === entrada.email || item.login === entrada.login,
    )
  ) {
    return { erro: EMAIL_TEM_CONTA, email: '', nome: '', token: '' }
  }
  if (store.pedidos.some((item) => item.email === entrada.email && item.situacao === 'pendente')) {
    return { erro: EMAIL_EM_USO, email: '', nome: '', token: '' }
  }
  const pedidoId = crypto.randomUUID()
  store.pedidos.push({
    id: pedidoId,
    nome,
    primeiroNome: entrada.primeiroNome,
    sobrenome: entrada.sobrenome,
    email: entrada.email,
    celular: entrada.celular,
    criadoEm: new Date().toISOString(),
    situacao: 'aprovado',
    decididoEm: new Date().toISOString(),
    decididoPor: ator,
    papel: grupo.diretiva === 'administrador' ? 'administrador' : 'comum',
    grupoId: grupo.id,
    loginEscolhido: entrada.login,
    noExecutor: entrada.noExecutor,
  })
  const token = emitirLink(store.links, {
    tipo: 'confirmacao',
    email: entrada.email,
    pedidoId,
    usuarioId: null,
  })
  return { erro: null, email: entrada.email, nome, token }
}

async function convidarNuvem(
  entrada: {
    primeiroNome: string
    sobrenome: string
    email: string
    celular: string
    login: string
    grupoId: string
    noExecutor: boolean
  },
  nome: string,
  ator: string,
) {
  const grupos = await listarGrupos()
  const grupo = grupos.find((item) => item.id === entrada.grupoId && item.diretiva)
  if (!grupo) return { erro: 'Escolha um grupo que já tenha diretiva.', email: '', nome: '', token: '' }
  if (
    (await existeEmailExato(entrada.email)) ||
    (await existeLogin(entrada.email)) ||
    (await existeLogin(entrada.login))
  ) {
    return { erro: EMAIL_TEM_CONTA, email: '', nome: '', token: '' }
  }
  if (await existePedidoPendente(entrada.email)) return { erro: EMAIL_EM_USO, email: '', nome: '', token: '' }
  const pedidoId = crypto.randomUUID()
  try {
    await inserirPedido({
      id: pedidoId,
      nome,
      primeiro_nome: entrada.primeiroNome,
      sobrenome: entrada.sobrenome,
      email: entrada.email,
      celular: entrada.celular,
      situacao: 'aprovado',
      decidido_em: new Date().toISOString(),
      decidido_por: ator,
      papel: grupo.diretiva === 'administrador' ? 'administrador' : 'comum',
      grupo_id: grupo.id,
      login_escolhido: entrada.login,
      no_executor: entrada.noExecutor,
    })
  } catch (erro) {
    return { erro: traduzirUnico(erro, { pedidos_acesso_email_pendente: EMAIL_EM_USO }), email: '', nome: '', token: '' }
  }
  const token = await emitirNaNuvem({
    tipo: 'confirmacao',
    email: entrada.email,
    pedidoId,
    usuarioId: null,
  })
  return { erro: null, email: entrada.email, nome, token }
}

export async function ocultarBoasVindasDaConta(id: string) {
  if (!idSeguro(id)) return
  if (!supabaseConfigurado()) {
    await alterarLocal((store) => {
      const atual = store.usuarios.find((item) => item.id === id)
      if (atual) atual.ocultarBoasVindas = true
    })
    return
  }
  await atualizarOnde<{ id: string }>('usuarios', `${filtro('id', 'eq', id)}&select=id`, {
    ocultar_boas_vindas: true,
  })
}

export async function salvarEstadoEntrega(linha: EntregaEstadoRow) {
  if (!/^[\w-]+$/.test(linha.entrega_id)) throw new Error('Entrega inválida.')
  if (supabaseConfigurado()) {
    await gravarTabela('entrega_estados', [linha])
    return
  }
  await alterarLocal((store) => {
    const atual = store.estados.find((item) => item.entrega_id === linha.entrega_id)
    if (atual) Object.assign(atual, linha)
    else store.estados.push({ ...linha })
  })
}

function gruposSinteticos(usuarios: UsuarioPublico[]): GrupoRegistro[] {
  return [
    {
      id: GRUPO_ADMINISTRADORES,
      nome: 'Administradores',
      diretiva: 'administrador',
      sistema: true,
      membros: usuarios.filter((item) => item.papel === 'administrador').map((item) => item.id),
    },
    {
      id: GRUPO_ACESSO_COMUM,
      nome: 'Acesso comum',
      diretiva: 'acesso_comum',
      sistema: true,
      membros: usuarios.filter((item) => item.papel !== 'administrador').map((item) => item.id),
    },
    {
      id: GRUPO_EXECUTOR,
      nome: 'Executor',
      diretiva: null,
      sistema: true,
      membros: usuarios.filter((item) => item.noGrupoExecutor).map((item) => item.id),
    },
  ]
}

export async function listarGrupos(): Promise<GrupoRegistro[]> {
  if (!supabaseConfigurado()) {
    const store = await lerOperacaoLocal()
    return store.grupos.map((grupo) => ({ ...grupo, membros: [...grupo.membros] }))
  }
  try {
    const linhas = await lerTabela<{
      id: string
      nome: string
      diretiva: DiretivaGrupo | null
      sistema: boolean
    }>('grupos', 'select=id,nome,diretiva,sistema&order=nome.asc')
    const membros = await lerTabela<{ grupo: string; usuario_id: string }>('grupo_membros', 'select=grupo,usuario_id')
    return linhas.map((grupo) => ({
      id: grupo.id,
      nome: grupo.nome,
      diretiva: grupo.diretiva,
      sistema: grupo.sistema,
      membros: membros.filter((item) => item.grupo === grupo.id).map((item) => item.usuario_id),
    }))
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro
    return gruposSinteticos(await listarUsuariosPublicos())
  }
}

async function gravarMembrosNuvem(id: string, gruposIds: string[]) {
  try {
    await apagarOnde('grupo_membros', `${filtro('usuario_id', 'eq', id)}`)
    if (gruposIds.length > 0) {
      await gravarTabela(
        'grupo_membros',
        gruposIds.map((grupo) => ({ grupo, usuario_id: id })),
      )
    }
    return null
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro
    const estranho = gruposIds.find(
      (grupo) => grupo !== GRUPO_ADMINISTRADORES && grupo !== GRUPO_ACESSO_COMUM && grupo !== GRUPO_EXECUTOR,
    )
    if (estranho) return 'Criar grupo novo precisa da migração no banco.'
    await definirMembroExecutorNuvem(id, gruposIds.includes(GRUPO_EXECUTOR))
    return null
  }
}

export async function criarGrupoAcesso(nome: string, diretiva: DiretivaGrupo, ator: string) {
  const limpo = nome.trim()
  if (limpo.length < 2) return 'O nome do grupo precisa de ao menos 2 caracteres.'
  if (!supabaseConfigurado()) {
    const erro = await alterarLocal((store) => {
      if (store.grupos.some((grupo) => grupo.nome.toLowerCase() === limpo.toLowerCase())) {
        return 'Já existe um grupo com esse nome.'
      }
      store.grupos.push({
        id: idDeNome(limpo, new Set(store.grupos.map((grupo) => grupo.id))),
        nome: limpo,
        diretiva,
        sistema: false,
        membros: [],
      })
      return null
    })
    if (erro) return erro
  } else {
    try {
      const id = idDeNome(limpo, new Set((await listarGrupos()).map((grupo) => grupo.id)))
      await inserirLinha('grupos', { id, nome: limpo, diretiva, sistema: false }, 'id')
    } catch (erro) {
      if (ehTabelaAusente(erro)) return 'Criar grupo novo precisa da migração no banco.'
      throw erro
    }
  }
  await registrarEvento({
    nivel: 'info',
    evento: 'GROUP_CREATED',
    ator,
    mensagem: `${ator} criou o grupo ${limpo}.`,
    detalhe: { grupo: limpo, diretiva },
  })
  return null
}

export async function excluirGrupoAcesso(id: string, ator: string) {
  if (!idSeguro(id)) return 'Grupo não encontrado.'
  if (!supabaseConfigurado()) {
    const erro = await alterarLocal((store) => {
      const grupo = store.grupos.find((item) => item.id === id)
      if (!grupo) return 'Grupo não encontrado.'
      if (grupo.sistema) return 'Este grupo faz parte da aplicação e não se apaga.'
      if (grupo.membros.length > 0) return 'Grupo com membro não se apaga.'
      const outrosAdmin = store.grupos.filter(
        (item) => item.id !== id && item.diretiva === 'administrador',
      )
      if (grupo.diretiva === 'administrador' && outrosAdmin.length === 0) {
        return 'O último grupo de administrador não se apaga.'
      }
      store.grupos = store.grupos.filter((item) => item.id !== id)
      return null
    })
    if (erro) return erro
  } else {
    const grupos = await listarGrupos()
    const grupo = grupos.find((item) => item.id === id)
    if (!grupo) return 'Grupo não encontrado.'
    if (grupo.sistema) return 'Este grupo faz parte da aplicação e não se apaga.'
    if (grupo.membros.length > 0) return 'Grupo com membro não se apaga.'
    try {
      await apagarOnde('grupos', `${filtro('id', 'eq', id)}&select=id`)
    } catch (erro) {
      if (ehTabelaAusente(erro)) return 'Criar grupo novo precisa da migração no banco.'
      throw erro
    }
  }
  await registrarEvento({
    nivel: 'info',
    evento: 'GROUP_DELETED',
    ator,
    mensagem: `${ator} excluiu um grupo.`,
    detalhe: { grupo: id },
  })
  return null
}

export async function alternarMembroGrupo(grupoId: string, usuarioId: string, incluir: boolean, ator: string) {
  if (!idSeguro(grupoId) || !idSeguro(usuarioId)) return 'Não foi possível alterar o grupo.'
  if (!supabaseConfigurado()) {
    const erro = await alterarLocal((store) => {
      const grupo = store.grupos.find((item) => item.id === grupoId)
      const usuario = store.usuarios.find((item) => item.id === usuarioId)
      if (!grupo || !usuario) return 'Não foi possível alterar o grupo.'
      const gruposIds = store.grupos.filter((item) => item.membros.includes(usuarioId)).map((item) => item.id)
      const proximos = incluir
        ? [...new Set([...gruposIds, grupoId])]
        : gruposIds.filter((item) => item !== grupoId)
      const comDiretiva = store.grupos.some((item) => proximos.includes(item.id) && item.diretiva)
      if (!comDiretiva) return 'A conta precisa de um grupo com diretiva.'
      const antes = copiaGrupos(store)
      const papelAntes = usuario.papel
      definirGruposDoUsuario(store, usuarioId, proximos)
      const sobra = store.usuarios.some((item) => item.papel === 'administrador' && item.situacao === 'ativa')
      if (!sobra) {
        restaurarGrupos(store, antes)
        usuario.papel = papelAntes
        return 'O único administrador ativo não pode sair do último grupo de administrador.'
      }
      return null
    })
    if (erro) return erro
  } else {
    const grupos = await listarGrupos()
    const usuarios = await listarUsuariosPublicos()
    const usuario = usuarios.find((item) => item.id === usuarioId)
    const grupo = grupos.find((item) => item.id === grupoId)
    if (!usuario || !grupo) return 'Não foi possível alterar o grupo.'
    const atuais = grupos.filter((item) => item.membros.includes(usuarioId)).map((item) => item.id)
    const proximos = incluir ? [...new Set([...atuais, grupoId])] : atuais.filter((item) => item !== grupoId)
    const papel: Papel = grupos.some((item) => proximos.includes(item.id) && item.diretiva === 'administrador')
      ? 'administrador'
      : 'comum'
    if (!grupos.some((item) => proximos.includes(item.id) && item.diretiva)) {
      return 'A conta precisa de um grupo com diretiva.'
    }
    const ids = await idsAdministradoresAtivos()
    if (!sobraAdministrador(ids, usuarioId, papel, usuario.situacao === 'ativa')) {
      return 'O único administrador ativo não pode sair do último grupo de administrador.'
    }
    await gravarConta(usuarioId, { papel })
    const erro = await gravarMembrosNuvem(usuarioId, proximos)
    if (erro) return erro
  }
  await registrarEvento({
    nivel: 'info',
    evento: incluir ? 'GROUP_MEMBER_ADDED' : 'GROUP_MEMBER_REMOVED',
    ator,
    mensagem: incluir ? `${ator} incluiu uma conta no grupo.` : `${ator} tirou uma conta do grupo.`,
    detalhe: { grupo: grupoId, usuario: usuarioId },
  })
  return null
}
