import type { CotacaoLida } from '@/lib/planilha/cotacao'
import { lerPlanilha, type PlanilhaLida } from '@/lib/planilha/ler'
import type { Lancamento, Projeto } from '@/lib/projetos/tipos'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const PASTA = path.join(process.cwd(), 'data', 'projetos')
const INDICE = path.join(PASTA, 'indice.json')

let fila: Promise<unknown> = Promise.resolve()

async function lerIndice(): Promise<Projeto[]> {
  try {
    const bruto = await readFile(INDICE, 'utf8')
    const json = JSON.parse(bruto) as { projetos?: Projeto[] }
    return json.projetos ?? []
  } catch {
    return []
  }
}

async function gravarIndice(projetos: Projeto[]) {
  await mkdir(PASTA, { recursive: true })
  await writeFile(INDICE, JSON.stringify({ projetos }, null, 2), { mode: 0o600 })
}

export async function alterarProjetos<T>(fn: (projetos: Projeto[]) => T | Promise<T>): Promise<T> {
  const exec = fila.then(async () => {
    const projetos = await lerIndice()
    const resultado = await fn(projetos)
    await gravarIndice(projetos)
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
  return readFile(caminhoDoArquivo(id))
}

export async function gravarArquivoDoProjeto(id: string, buf: Buffer) {
  await mkdir(PASTA, { recursive: true })
  await writeFile(caminhoDoArquivo(id), buf, { mode: 0o600 })
}

export async function apagarArquivoDoProjeto(id: string) {
  if (!/^[\w-]+$/.test(id)) return
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

export function lancamentoDaLinha(
  projeto: Projeto,
  linha: number,
  origem: { quantidade: string; material: string; maoDeObra: string },
): Lancamento {
  return (
    projeto.lancamentos[String(linha)] ?? {
      quantidade: origem.quantidade,
      material: origem.material,
      maoDeObra: origem.maoDeObra,
    }
  )
}

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
