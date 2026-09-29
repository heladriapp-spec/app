import type { EntregaEstadoRow } from '@/lib/entregas/tipos'
import { hashSenha } from '@/lib/auth/senha'
import { apagarFora, gravarTabela, lerTabela, supabaseConfigurado } from '@/lib/supabase/nuvem'
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
  estados: EntregaEstadoRow[]
  logs: LogRegistro[]
}

const ARQUIVO = path.join(process.cwd(), 'data', 'operacao.json')
const LIMITE_LOGS = 400

let fila: Promise<unknown> = Promise.resolve()

function semear(): Store {
  return {
    usuarios: [
      {
        id: 'instalacao-adm',
        nome: 'Administrador',
        email: null,
        celular: null,
        login: 'adm',
        senhaHash: hashSenha('Administrador@001'),
        papel: 'administrador',
        ativo: true,
        origem: 'instalacao',
      },
      {
        id: 'instalacao-convidado',
        nome: 'Convidado',
        email: null,
        celular: null,
        login: 'convidado',
        senhaHash: hashSenha('convidado@1'),
        papel: 'comum',
        ativo: true,
        origem: 'instalacao',
      },
    ],
    pedidos: [],
    estados: [],
    logs: [],
  }
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

export async function alterarStore<T>(fn: (store: Store) => T): Promise<T> {
  const exec = fila.then(async () => {
    const store = supabaseConfigurado() ? await lerNuvem() : ((await lerDisco()) ?? semear())
    const resultado = fn(store)
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

export async function lerStore() {
  if (supabaseConfigurado()) return lerNuvem()
  const atual = await lerDisco()
  if (atual) return atual
  return alterarStore((store) => store)
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
  const [usuarios, pedidos, estados, logs] = await Promise.all([
    lerTabela<UsuarioRow>('usuarios', 'select=*&order=login.asc'),
    lerTabela<PedidoRow>('pedidos_acesso', 'select=*&order=criado_em.asc'),
    lerTabela<EntregaEstadoRow>('entrega_estados', 'select=*'),
    lerTabela<LogRow>('logs', 'select=*&order=em.desc&limit=400'),
  ])
  if (usuarios.length === 0) {
    const vazio = semear()
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
  await gravarTabela(
    'usuarios',
    store.usuarios.map((item) => ({
      id: item.id,
      nome: item.nome,
      email: item.email,
      celular: item.celular,
      login: item.login,
      senha_hash: item.senhaHash,
      papel: item.papel,
      ativo: item.ativo,
      origem: item.origem,
    })),
  )
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
