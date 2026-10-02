import { acharLink, hashDoToken, tokenInformado, type LinkAcesso, type TipoLink } from '@/lib/auth/links'
import type { EntregaEstadoRow } from '@/lib/entregas/tipos'
import { hashSenha } from '@/lib/auth/senha'
import { cache } from 'react'
import {
  apagarFora,
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
const LIMITE_LOGS = 400

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

export function registrarNo(
  store: Store,
  entrada: Omit<LogRegistro, 'id' | 'em'> & { em?: string },
) {
  const detalhe: LogRegistro['detalhe'] = {}
  for (const [chave, valor] of Object.entries(entrada.detalhe)) {
    if (/senha|token|secret|chave|hash/i.test(chave)) continue
    detalhe[chave] = valor
  }
  store.logs.push({
    id: crypto.randomUUID(),
    em: entrada.em ?? new Date().toISOString(),
    nivel: entrada.nivel,
    evento: entrada.evento,
    ator: entrada.ator,
    mensagem: entrada.mensagem,
    detalhe,
  })
  if (store.logs.length > LIMITE_LOGS) {
    store.logs.splice(0, store.logs.length - LIMITE_LOGS)
  }
}

export async function alterarStore<T>(fn: (store: Store) => T | Promise<T>): Promise<T> {
  const exec = fila.then(async () => {
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
  fila = exec.then(
    () => undefined,
    () => undefined,
  )
  return exec
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
    return store.logs
  }
  const linhas = await lerTabela<LogRow>(
    'logs',
    'select=id,em,nivel,evento,ator,mensagem,detalhe&order=em.desc&limit=400',
  )
  return linhas.reverse().map(logDe)
}

export async function listarAtoresComLogin(): Promise<Set<string>> {
  if (!supabaseConfigurado()) {
    const store = await lerOperacaoLocal()
    return new Set(
      store.logs.filter((item) => item.evento === 'USER_LOGIN' && item.ator).map((item) => item.ator as string),
    )
  }
  const linhas = await lerTabela<{ evento: string; ator: string | null }>(
    'logs',
    'select=evento,ator&order=em.desc&limit=400',
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
    lerTabela<LogRow>('logs', 'select=*&order=em.desc&limit=400'),
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
