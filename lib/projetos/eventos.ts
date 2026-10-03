import { ehTabelaAusente, inserirLinha, lerTabela, supabaseConfigurado } from '@/lib/supabase/nuvem'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const PASTA = path.join(process.cwd(), 'data', 'projetos')
const ARQUIVO = path.join(PASTA, 'eventos.json')

export type TipoEventoProjeto =
  | 'submetido'
  | 'campo'
  | 'excluiu_item'
  | 'reincluiu_item'
  | 'participante_incluido'
  | 'participante_removido'
  | 'restaurou'

export type DetalheEvento = {
  item?: string
  rotulo?: string
  campo?: string
  anterior?: string
  novo?: string
  versao?: number
  origem?: number
  usuarioId?: string
  login?: string
}

export type EventoProjeto = {
  id: string
  projetoId: string
  em: string
  tipo: TipoEventoProjeto
  ator: string
  detalhe: DetalheEvento
}

let fila: Promise<unknown> = Promise.resolve()

/** Transição do projeto. Não entra no log geral, que tem teto e mistura o login. */
export async function registrarEventoProjeto(evento: Omit<EventoProjeto, 'id' | 'em' | 'detalhe'> & { detalhe?: DetalheEvento }) {
  const linha: EventoProjeto = {
    id: crypto.randomUUID(),
    em: new Date().toISOString(),
    detalhe: {},
    ...evento,
  }
  if (!/^[\w-]+$/.test(linha.projetoId)) return
  if (!supabaseConfigurado()) {
    await enfileirar(async () => {
      const lista = await ler()
      lista.push(linha)
      await mkdir(PASTA, { recursive: true })
      await writeFile(ARQUIVO, JSON.stringify({ eventos: lista }, null, 2), { mode: 0o600 })
    })
    return
  }
  try {
    await inserirLinha(
      'projeto_eventos',
      {
        id: linha.id,
        projeto_id: linha.projetoId,
        em: linha.em,
        tipo: linha.tipo,
        ator: linha.ator,
        detalhe: linha.detalhe,
      },
      'id',
    )
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro
  }
}

export async function apagarEventosLocais(projetoId: string) {
  if (supabaseConfigurado() || !/^[\w-]+$/.test(projetoId)) return
  await enfileirar(async () => {
    const lista = (await ler()).filter((item) => item.projetoId !== projetoId)
    await mkdir(PASTA, { recursive: true })
    await writeFile(ARQUIVO, JSON.stringify({ eventos: lista }, null, 2), { mode: 0o600 })
  })
}

export async function listarEventosProjeto(projetoId: string) {
  if (!/^[\w-]+$/.test(projetoId)) return []
  if (!supabaseConfigurado()) {
    return (await ler()).filter((item) => item.projetoId === projetoId)
  }
  try {
    const linhas = await lerTabela<{
      id: string
      projeto_id: string
      em: string
      tipo: TipoEventoProjeto
      ator: string
      detalhe: DetalheEvento | null
    }>(
      'projeto_eventos',
      `select=id,projeto_id,em,tipo,ator,detalhe&projeto_id=eq.${projetoId}&order=em.asc`,
    )
    return linhas.map((item) => ({
      id: item.id,
      projetoId: item.projeto_id,
      em: item.em,
      tipo: item.tipo,
      ator: item.ator,
      detalhe: item.detalhe ?? {},
    }))
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro
    return []
  }
}

async function ler() {
  try {
    const bruto = await readFile(ARQUIVO, 'utf8')
    const json = JSON.parse(bruto) as { eventos?: EventoProjeto[] }
    return (json.eventos ?? []).map((item) => ({ ...item, detalhe: item.detalhe ?? {} }))
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw erro
  }
}

function enfileirar<T>(fn: () => Promise<T>) {
  const exec = fila.then(fn)
  fila = exec.then(
    () => undefined,
    () => undefined,
  )
  return exec
}
