import type { CotacaoLida } from '@/lib/planilha/cotacao'
import { canonizarStatus, opcoesStatus } from '@/lib/planilha/status'
import { lerPlanilha, type CapaPlanilha, type PlanilhaLida } from '@/lib/planilha/ler'
import type { ExtraServico, Lancamento, Projeto, ProjetoLista, StatusProjeto } from '@/lib/projetos/tipos'
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
    return (json.projetos ?? []).map(completarProjeto)
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
  arquivo_gerado_nome: string | null
  concluido_em: string | null
  concluido_por: string | null
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
    arquivoGeradoNome: item.arquivo_gerado_nome,
    concluidoEm: item.concluido_em,
    concluidoPor: item.concluido_por,
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
      arquivo_gerado_nome: item.arquivoGeradoNome,
      concluido_em: item.concluidoEm,
      concluido_por: item.concluidoPor,
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

/** Só o JSON local. No Supabase, a exclusão do usuário cai na cascata já existente. */
export async function tirarParticipanteLocal(usuarioId: string) {
  if (supabaseConfigurado()) return
  if (!/^[\w-]+$/.test(usuarioId)) return
  await alterarProjetos((projetos) => {
    for (const projeto of projetos) {
      projeto.participantes = projeto.participantes.filter((item) => item !== usuarioId)
    }
  })
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

const COLUNAS_LISTA = 'id,nome,data,status,criado_por,atualizado_em,atualizado_por,arquivo_nome'
const COLUNAS_PROJETO =
  'id,nome,data,criado_em,criado_por,atualizado_em,atualizado_por,arquivo_nome,arquivo_gerado_nome,concluido_em,concluido_por,capa,status,lancamentos'

function idSeguro(id: string) {
  return /^[\w-]+$/.test(id)
}

function resumoDe(projeto: Projeto): ProjetoLista {
  return {
    id: projeto.id,
    nome: projeto.nome,
    data: projeto.data,
    status: projeto.status,
    criadoPor: projeto.criadoPor,
    atualizadoEm: projeto.atualizadoEm,
    atualizadoPor: projeto.atualizadoPor,
    arquivoNome: projeto.arquivoNome,
  }
}

function resumoDaLinha(
  item: Pick<ProjetoRow, 'id' | 'nome' | 'data' | 'status' | 'criado_por' | 'atualizado_em' | 'atualizado_por' | 'arquivo_nome'>,
): ProjetoLista {
  return {
    id: item.id,
    nome: item.nome,
    data: String(item.data).slice(0, 10),
    status: item.status,
    criadoPor: item.criado_por,
    atualizadoEm: item.atualizado_em,
    atualizadoPor: item.atualizado_por,
    arquivoNome: item.arquivo_nome,
  }
}

export async function listarProjetos(usuario: { id: string; papel: string }): Promise<ProjetoLista[]> {
  const administrador = usuario.papel === 'administrador'
  if (!supabaseConfigurado()) {
    const projetos = await lerIndice()
    const visiveis = administrador
      ? projetos
      : projetos.filter((item) => item.participantes.includes(usuario.id))
    return visiveis.map(resumoDe)
  }
  if (!administrador) {
    if (!idSeguro(usuario.id)) return []
    const vinculos = await lerTabela<{ projeto_id: string }>(
      'projeto_participantes',
      `select=projeto_id&usuario_id=eq.${usuario.id}`,
    )
    const ids = vinculos.map((item) => item.projeto_id).filter(idSeguro)
    if (ids.length === 0) return []
    const lista = ids.map((id) => `"${id}"`).join(',')
    const linhas = await lerTabela<ProjetoRow>(
      'projetos',
      `select=${COLUNAS_LISTA}&id=in.(${lista})&order=criado_em.asc`,
    )
    return linhas.map(resumoDaLinha)
  }
  const linhas = await lerTabela<ProjetoRow>('projetos', `select=${COLUNAS_LISTA}&order=criado_em.asc`)
  return linhas.map(resumoDaLinha)
}

const COLUNAS_ARQUIVO = 'id,arquivo_nome,arquivo_gerado_nome'

export async function projetoParaArquivo(id: string) {
  if (!idSeguro(id)) return null
  if (!supabaseConfigurado()) {
    const projeto = await projetoPorId(id)
    if (!projeto) return null
    return {
      id: projeto.id,
      participantes: projeto.participantes,
      arquivoNome: projeto.arquivoNome,
      arquivoGeradoNome: projeto.arquivoGeradoNome,
    }
  }
  const [linhas, vinculos] = await Promise.all([
    lerTabela<Pick<ProjetoRow, 'id' | 'arquivo_nome' | 'arquivo_gerado_nome'>>(
      'projetos',
      `select=${COLUNAS_ARQUIVO}&id=eq.${id}&limit=1`,
    ),
    lerTabela<{ usuario_id: string }>('projeto_participantes', `select=usuario_id&projeto_id=eq.${id}`),
  ])
  const item = linhas[0]
  if (!item) return null
  return {
    id: item.id,
    participantes: vinculos.map((vinculo) => vinculo.usuario_id),
    arquivoNome: item.arquivo_nome,
    arquivoGeradoNome: item.arquivo_gerado_nome,
  }
}

export async function projetoPorId(id: string) {
  if (!idSeguro(id)) return null
  if (!supabaseConfigurado()) {
    const projetos = await lerIndice()
    return projetos.find((item) => item.id === id) ?? null
  }
  const [linhas, vinculos] = await Promise.all([
    lerTabela<ProjetoRow>('projetos', `select=${COLUNAS_PROJETO}&id=eq.${id}&limit=1`),
    lerTabela<{ usuario_id: string }>('projeto_participantes', `select=usuario_id&projeto_id=eq.${id}`),
  ])
  const item = linhas[0]
  if (!item) return null
  return {
    id: item.id,
    nome: item.nome,
    data: String(item.data).slice(0, 10),
    criadoEm: item.criado_em,
    criadoPor: item.criado_por,
    atualizadoEm: item.atualizado_em,
    atualizadoPor: item.atualizado_por,
    participantes: vinculos.map((vinculo) => vinculo.usuario_id),
    arquivoNome: item.arquivo_nome,
    arquivoGeradoNome: item.arquivo_gerado_nome,
    concluidoEm: item.concluido_em,
    concluidoPor: item.concluido_por,
    capa: item.capa,
    status: item.status,
    lancamentos: item.lancamentos ?? {},
  }
}

export function caminhoDoArquivo(id: string) {
  return path.join(PASTA, `${id}.xlsx`)
}

function caminhoGerado(id: string) {
  return path.join(PASTA, `${id}.gerado.xlsx`)
}

export function nomeDeDownload(original: string | null) {
  const base = (original || 'planilha.xlsx').split(/[/\\]/).pop()?.replace(/["\r\n]/g, '') || 'planilha.xlsx'
  return base.toLowerCase().endsWith('.xlsx') ? base : `${base}.xlsx`
}

export async function lerArquivoDoProjeto(id: string) {
  if (supabaseConfigurado()) return baixarPlanilha(id, 'origem')
  return readFile(caminhoDoArquivo(id))
}

export async function gravarArquivoDoProjeto(id: string, buf: Buffer) {
  if (supabaseConfigurado()) {
    await enviarPlanilha(id, 'origem', buf)
    return
  }
  await mkdir(PASTA, { recursive: true })
  await writeFile(caminhoDoArquivo(id), buf, { mode: 0o600 })
}

export async function lerArquivoGerado(id: string) {
  if (supabaseConfigurado()) return baixarPlanilha(id, 'gerado')
  return readFile(caminhoGerado(id))
}

export async function gravarArquivoGerado(id: string, buf: Buffer) {
  if (supabaseConfigurado()) {
    await enviarPlanilha(id, 'gerado', buf)
    return
  }
  await mkdir(PASTA, { recursive: true })
  await writeFile(caminhoGerado(id), buf, { mode: 0o600 })
}

async function apagarSeExistir(caminho: string) {
  try {
    await unlink(caminho)
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro
  }
}

export async function apagarArquivoGerado(id: string) {
  if (!/^[\w-]+$/.test(id)) return
  if (supabaseConfigurado()) {
    await removerPlanilha(id, 'gerado')
    return
  }
  await apagarSeExistir(caminhoGerado(id))
}

export async function apagarArquivoDoProjeto(id: string) {
  if (!/^[\w-]+$/.test(id)) return
  if (supabaseConfigurado()) {
    await removerPlanilha(id, 'origem')
    await removerPlanilha(id, 'gerado')
    return
  }
  await apagarSeExistir(caminhoDoArquivo(id))
  await apagarSeExistir(caminhoGerado(id))
}

export function limparConclusao(projeto: Projeto) {
  projeto.arquivoGeradoNome = null
  projeto.concluidoEm = null
  projeto.concluidoPor = null
}

export function aplicarPlanilha(
  projeto: Projeto,
  nome: string,
  lida: PlanilhaLida,
  ator: string,
  rascunho = false,
) {
  projeto.arquivoNome = nome
  projeto.capa = lida.capa
  projeto.status = rascunho ? 'rascunho' : 'em_preenchimento'
  projeto.lancamentos = {}
  limparConclusao(projeto)
  projeto.atualizadoEm = new Date().toISOString()
  projeto.atualizadoPor = ator
}

function completarProjeto(projeto: Projeto): Projeto {
  return {
    ...projeto,
    arquivoNome: projeto.arquivoNome ?? null,
    arquivoGeradoNome: projeto.arquivoGeradoNome ?? null,
    concluidoEm: projeto.concluidoEm ?? null,
    concluidoPor: projeto.concluidoPor ?? null,
    participantes: projeto.participantes ?? [],
    lancamentos: projeto.lancamentos ?? {},
    capa: projeto.capa ?? null,
  }
}

export { lancamentoDaLinha } from '@/lib/projetos/lancamento'

export async function planilhaDoProjeto(projeto: Projeto) {
  if (!projeto.arquivoNome) return null
  const buf = await lerArquivoDoProjeto(projeto.id)
  return lerPlanilha(buf)
}

export function valoresDaCotacao(projeto: Projeto, cotacao: CotacaoLida) {
  const opcoes = opcoesStatus(cotacao.legenda)
  const iniciais: Record<
    string,
    { valor: string; observacao: string; valorBase: string; extras: ExtraServico[]; status: string }
  > = {}
  for (const item of [...cotacao.materiais, ...cotacao.maoDeObra]) {
    const salvo = projeto.lancamentos[item.codigo]
    const bruto = salvo?.status?.trim() || item.status
    const status = canonizarStatus(bruto, opcoes) || bruto
    iniciais[item.codigo] = salvo
      ? {
          valor: salvo.valor ?? '',
          observacao: salvo.observacao ?? '',
          valorBase: salvo.valorBase ?? '',
          extras: salvo.extras ?? [],
          status,
        }
      : {
          valor: item.valor,
          observacao: item.observacao,
          valorBase: '',
          extras: [],
          status,
        }
  }
  return iniciais
}
