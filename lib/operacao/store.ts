import type { EntregaEstadoRow } from '@/lib/entregas/tipos'
import { hashSenha } from '@/lib/auth/senha'
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
    const store = (await lerDisco()) ?? semear()
    const resultado = fn(store)
    await gravarDisco(store)
    return resultado
  })
  fila = exec.then(
    () => undefined,
    () => undefined,
  )
  return exec
}

export async function lerStore() {
  const atual = await lerDisco()
  if (atual) return atual
  return alterarStore((store) => store)
}
