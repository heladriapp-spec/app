import type { CotacaoLida } from '@/lib/planilha/cotacao'
import { lerPlanilha, type CapaPlanilha, type PlanilhaLida } from '@/lib/planilha/ler'
import type { Lancamento, Projeto, StatusProjeto } from '@/lib/projetos/tipos'
import {
  apagarFora,
  baixarPlanilha,
  enviarPlanilha,
  gravarTabela,
  lerTabela,
  removerPlanilha,
  supabaseConfigurado,
} from '@/lib/supabase/nuvem'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const PASTA = path.join(process.cwd(), 'data', 'projetos')
const INDICE = path.join(PASTA, 'indice.json')

let fila: Promise<unknown> = Promise.resolve()

async function lerIndice(): Promise<Projeto[]> {
  if (supabaseConfigurado()) return lerNuvem()
  try {
    const bruto = await readFile(INDICE, 'utf8')
    const json = JSON.parse(bruto) as { projetos?: Projeto[] }
    return json.projetos ?? []
  } catch {
    return []
  }
}

type ProjetoRow = {
  id: string
  nome: string
  data: string
  criado_em: string
  criado_por: string
  atualizado_em: string
  atualizado_por: string
  arquivo_nome: string | null
  arquivo_caminho: string | null
  capa: CapaPlanilha | null
  status: StatusProjeto
  lancamentos: Record<string, Lancamento> | null
}

async function lerNuvem(): Promise<Projeto[]> {
  const [linhas, vinculos] = await Promise.all([
    lerTabela<ProjetoRow>('projetos', 'select=*&order=criado_em.asc'),
    lerTabela<{ projeto_id: string; usuario_id: string }>(
      'projeto_participantes',
      'select=projeto_id,usuario_id',
    ),
  ])
  return linhas.map((item) => ({
    id: item.id,
    nome: item.nome,
    data: String(item.data).slice(0, 10),
    criadoEm: item.criado_em,
    criadoPor: item.criado_por,
    atualizadoEm: item.atualizado_em,
    atualizadoPor: item.atualizado_por,
    participantes: vinculos.filter((vinculo) => vinculo.projeto_id === item.id).map((vinculo) => vinculo.usuario_id),
    arquivoNome: item.arquivo_nome,
    capa: item.capa,
    status: item.status,
    lancamentos: item.lancamentos ?? {},
  }))
}

async function gravarNuvem(projetos: Projeto[]) {
  await gravarTabela(
    'projetos',
    projetos.map((item) => ({
      id: item.id,
      nome: item.nome,
      data: item.data,
      criado_em: item.criadoEm,
      criado_por: item.criadoPor,
      atualizado_em: item.atualizadoEm,
      atualizado_por: item.atualizadoPor,
      arquivo_nome: item.arquivoNome,
      arquivo_caminho: item.arquivoNome ? `${item.id}.xlsx` : null,
      capa: item.capa,
      status: item.status,
      lancamentos: item.lancamentos,
    })),
  )
  await apagarFora(
    'projeto_participantes',
    'projeto_id',
    [],
  )
  await gravarTabela(
    'projeto_participantes',
    projetos.flatMap((item) => item.participantes.map((usuarioId) => ({ projeto_id: item.id, usuario_id: usuarioId }))),
  )
  await apagarFora(
    'projetos',
    'id',
    projetos.map((item) => item.id),
  )
}

async function gravarIndice(projetos: Projeto[]) {
  await mkdir(PASTA, { recursive: true })
  await writeFile(INDICE, JSON.stringify({ projetos }, null, 2), { mode: 0o600 })
}

export async function alterarProjetos<T>(fn: (projetos: Projeto[]) => T | Promise<T>): Promise<T> {
  const exec = fila.then(async () => {
    const projetos = await lerIndice()
    const resultado = await fn(projetos)
    if (supabaseConfigurado()) await gravarNuvem(projetos)
    else await gravarIndice(projetos)
    return resultado
  })
  fila = exec.then(
    () => undefined,
    () => undefined,
  )
  return exec
}

export async function listarProjetos() {
  return lerIndice()
}

export async function projetoPorId(id: string) {
  const projetos = await lerIndice()
  return projetos.find((item) => item.id === id) ?? null
}

export function caminhoDoArquivo(id: string) {
  return path.join(PASTA, `${id}.xlsx`)
}

export async function lerArquivoDoProjeto(id: string) {
  if (supabaseConfigurado()) return baixarPlanilha(id)
  return readFile(caminhoDoArquivo(id))
}

export async function gravarArquivoDoProjeto(id: string, buf: Buffer) {
  if (supabaseConfigurado()) {
    await enviarPlanilha(id, buf)
    return
  }
  await mkdir(PASTA, { recursive: true })
  await writeFile(caminhoDoArquivo(id), buf, { mode: 0o600 })
}

export async function apagarArquivoDoProjeto(id: string) {
  if (!/^[\w-]+$/.test(id)) return
  if (supabaseConfigurado()) {
    await removerPlanilha(id)
    return
  }
  try {
    await unlink(caminhoDoArquivo(id))
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro
  }
}

export function aplicarPlanilha(projeto: Projeto, nome: string, lida: PlanilhaLida, ator: string) {
  projeto.arquivoNome = nome
  projeto.capa = lida.capa
  projeto.status = 'em_preenchimento'
  projeto.lancamentos = {}
  projeto.atualizadoEm = new Date().toISOString()
  projeto.atualizadoPor = ator
}

export { lancamentoDaLinha } from '@/lib/projetos/lancamento'

export async function planilhaDoProjeto(projeto: Projeto) {
  if (!projeto.arquivoNome) return null
  const buf = await lerArquivoDoProjeto(projeto.id)
  return lerPlanilha(buf)
}

export function valoresDaCotacao(projeto: Projeto, cotacao: CotacaoLida) {
  const iniciais: Record<string, { valor: string; observacao: string }> = {}
  for (const item of [...cotacao.materiais, ...cotacao.maoDeObra]) {
    const salvo = projeto.lancamentos[item.codigo]
    iniciais[item.codigo] = salvo
      ? { valor: salvo.valor ?? '', observacao: salvo.observacao ?? '' }
      : { valor: item.valor, observacao: item.observacao }
  }
  return iniciais
}
