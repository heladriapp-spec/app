import { acharLink, hashDoToken, tokenInformado, type LinkAcesso, type TipoLink } from '@/lib/auth/links'
import type { EntregaEstadoRow } from '@/lib/entregas/tipos'
import { hashSenha } from '@/lib/auth/senha'
import { cache } from 'react'
import {
  apagarFora,
  chamarFuncao,
  colunaQueFalta,
  ehTabelaAusente,
  gravarTabela,
  lerTabela,
  supabaseConfigurado,
} from '@/lib/supabase/nuvem'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type Papel = 'administrador' | 'comum'

export type Usuario = {
  id: string
  nome: string
  email: string | null
  celular: string | null
  login: string
  senhaHash: string
  papel: Papel
  ativo: boolean
  origem: 'instalacao' | 'pedido'
  ocultarBoasVindas: boolean
}

export type UsuarioPublico = Omit<Usuario, 'senhaHash'>

/** Usado só na validação da senha. Não enviar para páginas. */
export type UsuarioLogin = {
  id: string
  login: string
  senhaHash: string
  papel: Papel
  ativo: boolean
  ocultarBoasVindas: boolean
}

export type SituacaoPedido = 'pendente' | 'aprovado' | 'rejeitado'

export type PedidoAcesso = {
  id: string
  nome: string
  email: string
  celular: string
  criadoEm: string
  situacao: SituacaoPedido
  decididoEm: string | null
  decididoPor: string | null
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
        email: null,
        celular: null,
        login: 'adm',
        senhaHash: await hashSenha('Administrador@001'),
        papel: 'administrador',
        ativo: true,
        origem: 'instalacao',
        ocultarBoasVindas: false,
      },
      {
        id: 'instalacao-convidado',
        nome: 'Convidado',
        email: null,
        celular: null,
        login: 'convidado',
        senhaHash: await hashSenha('convidado@1'),
        papel: 'comum',
        ativo: true,
        origem: 'instalacao',
        ocultarBoasVindas: false,
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
  for (const usuario of store.usuarios) {
    if (typeof usuario.ocultarBoasVindas !== 'boolean') usuario.ocultarBoasVindas = false
  }
  return store
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

export function publico(usuario: Usuario): UsuarioPublico {
  const { senhaHash: _senha, ...resto } = usuario
  return resto
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

const COLUNAS_USUARIO =
  'id,nome,email,celular,login,papel,ativo,origem,ocultar_boas_vindas'

type UsuarioPublicoRow = Omit<UsuarioRow, 'senha_hash'>

function usuarioPublicoDe(item: UsuarioPublicoRow): UsuarioPublico {
  return {
    id: item.id,
    nome: item.nome,
    email: item.email,
    celular: item.celular,
    login: item.login,
    papel: item.papel,
    ativo: item.ativo,
    origem: item.origem,
    ocultarBoasVindas: item.ocultar_boas_vindas === true,
  }
}

async function lerUsuariosPublicos(filtro: string) {
  const semOcultar = COLUNAS_USUARIO.replace(',ocultar_boas_vindas', '')
  try {
    const linhas = await lerTabela<UsuarioPublicoRow>('usuarios', `select=${COLUNAS_USUARIO}&${filtro}`)
    return linhas.map(usuarioPublicoDe)
  } catch (erro) {
    if (colunaQueFalta(erro) !== 'ocultar_boas_vindas') throw erro
    const linhas = await lerTabela<UsuarioPublicoRow>('usuarios', `select=${semOcultar}&${filtro}`)
    return linhas.map(usuarioPublicoDe)
  }
}

const COLUNAS_LOGIN = 'id,login,senha_hash,papel,ativo,ocultar_boas_vindas'

function usuarioLoginDe(item: UsuarioLoginRow): UsuarioLogin {
  return {
    id: item.id,
    login: item.login,
    senhaHash: item.senha_hash,
    papel: item.papel,
    ativo: item.ativo,
    ocultarBoasVindas: item.ocultar_boas_vindas === true,
  }
}

async function lerUsuarioParaLogin(filtro: string) {
  const semOcultar = COLUNAS_LOGIN.replace(',ocultar_boas_vindas', '')
  try {
    const linhas = await lerTabela<UsuarioLoginRow>('usuarios', `select=${COLUNAS_LOGIN}&${filtro}`)
    return linhas.map(usuarioLoginDe)
  } catch (erro) {
    if (colunaQueFalta(erro) !== 'ocultar_boas_vindas') throw erro
    const linhas = await lerTabela<UsuarioLoginRow>('usuarios', `select=${semOcultar}&${filtro}`)
    return linhas.map(usuarioLoginDe)
  }
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
export async function buscarUsuarioParaLogin(login: string): Promise<UsuarioLogin | null> {
  if (!/^[a-z0-9._-]{1,64}$/.test(login)) return null
  if (!supabaseConfigurado()) {
    const store = await storeLocalParaLogin()
    const usuario = store.usuarios.find((item) => item.login === login)
    if (!usuario) return null
    return {
      id: usuario.id,
      login: usuario.login,
      senhaHash: usuario.senhaHash,
      papel: usuario.papel,
      ativo: usuario.ativo,
      ocultarBoasVindas: usuario.ocultarBoasVindas,
    }
  }
  const lista = await lerUsuarioParaLogin(`login=eq.${login}&limit=1`)
  return lista[0] ?? null
}

export async function buscarUsuarioPublicoPorId(id: string): Promise<UsuarioPublico | null> {
  if (!idSeguro(id)) return null
  if (!supabaseConfigurado()) {
    const store = await lerOperacaoLocal()
    const usuario = store.usuarios.find((item) => item.id === id)
    return usuario ? publico(usuario) : null
  }
  const lista = await lerUsuariosPublicos(`id=eq.${id}&limit=1`)
  return lista[0] ?? null
}

export async function listarUsuariosPublicos(): Promise<UsuarioPublico[]> {
  if (!supabaseConfigurado()) {
    const store = await lerOperacaoLocal()
    return store.usuarios.map(publico)
  }
  return lerUsuariosPublicos('order=login.asc')
}

export async function listarPedidos(): Promise<PedidoAcesso[]> {
  if (!supabaseConfigurado()) {
    const store = await lerOperacaoLocal()
    return store.pedidos
  }
  const linhas = await lerTabela<PedidoRow>(
    'pedidos_acesso',
    'select=id,nome,email,celular,criado_em,situacao,decidido_em,decidido_por&order=criado_em.asc',
  )
  return linhas.map(pedidoDe)
}

export async function buscarPedidoPorId(id: string): Promise<PedidoAcesso | null> {
  if (!idSeguro(id)) return null
  if (!supabaseConfigurado()) {
    const store = await lerOperacaoLocal()
    return store.pedidos.find((item) => item.id === id) ?? null
  }
  const linhas = await lerTabela<PedidoRow>(
    'pedidos_acesso',
    `select=id,nome,email,celular,criado_em,situacao,decidido_em,decidido_por&id=eq.${id}&limit=1`,
  )
  return linhas[0] ? pedidoDe(linhas[0]) : null
}

function pedidoDe(item: PedidoRow): PedidoAcesso {
  return {
    id: item.id,
    nome: item.nome,
    email: item.email,
    celular: item.celular,
    criadoEm: item.criado_em,
    situacao: item.situacao,
    decididoEm: item.decidido_em,
    decididoPor: item.decidido_por,
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
  ocultar_boas_vindas?: boolean | null
}

type UsuarioRow = {
  id: string
  nome: string
  email: string | null
  celular: string | null
  login: string
  senha_hash: string
  papel: Papel
  ativo: boolean
  origem: Usuario['origem']
  ocultar_boas_vindas?: boolean | null
}

type PedidoRow = {
  id: string
  nome: string
  email: string
  celular: string
  criado_em: string
  situacao: SituacaoPedido
  decidido_em: string | null
  decidido_por: string | null
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
  const [usuarios, pedidos, estados, logs, links] = await Promise.all([
    lerTabela<UsuarioRow>('usuarios', 'select=*&order=login.asc'),
    lerTabela<PedidoRow>('pedidos_acesso', 'select=*&order=criado_em.asc'),
    lerTabela<EntregaEstadoRow>('entrega_estados', 'select=*'),
    lerTabela<LogRow>('logs', `select=*&order=em.desc&limit=${JANELA_REESCRITA_LOGS}`),
    lerLinks(),
  ])
  if (usuarios.length === 0) {
    const vazio = await semear()
    await gravarNuvem(vazio)
    return vazio
  }
  return {
    usuarios: usuarios.map((item) => ({
      id: item.id,
      nome: item.nome,
      email: item.email,
      celular: item.celular,
      login: item.login,
      senhaHash: item.senha_hash,
      papel: item.papel,
      ativo: item.ativo,
      origem: item.origem,
      ocultarBoasVindas: item.ocultar_boas_vindas === true,
    })),
    pedidos: pedidos.map((item) => ({
      id: item.id,
      nome: item.nome,
      email: item.email,
      celular: item.celular,
      criadoEm: item.criado_em,
      situacao: item.situacao,
      decididoEm: item.decidido_em,
      decididoPor: item.decidido_por,
    })),
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
  await gravarUsuarios(store.usuarios)
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

async function gravarUsuarios(usuarios: Usuario[]) {
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
  try {
    await gravarTabela('usuarios', linhas)
  } catch (erro) {
    if (colunaQueFalta(erro) !== 'ocultar_boas_vindas') throw erro
    if (usuarios.some((item) => item.ocultarBoasVindas)) throw erro
    await gravarTabela(
      'usuarios',
      linhas.map(({ ocultar_boas_vindas: _ocultar, ...resto }) => resto),
    )
  }
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
