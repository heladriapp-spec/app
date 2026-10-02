import type { CotacaoLida } from '@/lib/planilha/cotacao'
import { canonizarStatus, opcoesStatus } from '@/lib/planilha/status'
import { lerPlanilha, type CapaPlanilha, type PlanilhaLida } from '@/lib/planilha/ler'
import type { ExtraServico, Lancamento, Projeto, ProjetoLista, StatusProjeto } from '@/lib/projetos/tipos'
import {
  apagarOnde,
  atualizarOnde,
  baixarPlanilha,
  enviarPlanilha,
  inserirLinha,
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

async function gravarIndice(projetos: Projeto[]) {
  await mkdir(PASTA, { recursive: true })
  await writeFile(INDICE, JSON.stringify({ projetos }, null, 2), { mode: 0o600 })
}

/** O arquivo local inteiro muda de uma vez. A regra só altera o projeto pedido. */
function alterarIndice<T>(fn: (projetos: Projeto[]) => T | Promise<T>): Promise<T> {
  const exec = fila.then(async () => {
    let projetos: Projeto[] = []
    try {
      const bruto = await readFile(INDICE, 'utf8')
      const json = JSON.parse(bruto) as { projetos?: Projeto[] }
      projetos = (json.projetos ?? []).map(completarProjeto)
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro
    }
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

export const AVISO_PROJETO_DESATUALIZADO =
  'Alguém gravou este projeto agora. Recarregue a página antes de salvar de novo.'

export class ProjetoDesatualizado extends Error {
  constructor() {
    super(AVISO_PROJETO_DESATUALIZADO)
    this.name = 'ProjetoDesatualizado'
  }
}

export type PatchProjeto = Partial<
  Pick<
    Projeto,
    | 'nome'
    | 'data'
    | 'atualizadoPor'
    | 'arquivoNome'
    | 'arquivoGeradoNome'
    | 'concluidoEm'
    | 'concluidoPor'
    | 'capa'
    | 'status'
    | 'lancamentos'
  >
>

function linhaDe(projeto: Projeto) {
  return {
    id: projeto.id,
    nome: projeto.nome,
    data: projeto.data,
    criado_em: projeto.criadoEm,
    criado_por: projeto.criadoPor,
    atualizado_em: projeto.atualizadoEm,
    atualizado_por: projeto.atualizadoPor,
    arquivo_nome: projeto.arquivoNome,
    arquivo_caminho: projeto.arquivoNome ? `${projeto.id}.xlsx` : null,
    arquivo_gerado_nome: projeto.arquivoGeradoNome,
    concluido_em: projeto.concluidoEm,
    concluido_por: projeto.concluidoPor,
    capa: projeto.capa,
    status: projeto.status,
    lancamentos: projeto.lancamentos,
  }
}

function aplicarPatch(atual: Projeto, patch: PatchProjeto, agora: string) {
  if (patch.nome !== undefined) atual.nome = patch.nome
  if (patch.data !== undefined) atual.data = patch.data
  if (patch.atualizadoPor !== undefined) atual.atualizadoPor = patch.atualizadoPor
  if (patch.arquivoNome !== undefined) atual.arquivoNome = patch.arquivoNome
  if (patch.arquivoGeradoNome !== undefined) atual.arquivoGeradoNome = patch.arquivoGeradoNome
  if (patch.concluidoEm !== undefined) atual.concluidoEm = patch.concluidoEm
  if (patch.concluidoPor !== undefined) atual.concluidoPor = patch.concluidoPor
  if (patch.capa !== undefined) atual.capa = patch.capa
  if (patch.status !== undefined) atual.status = patch.status
  if (patch.lancamentos !== undefined) atual.lancamentos = patch.lancamentos
  atual.atualizadoEm = agora
}

function corpoDoPatch(id: string, patch: PatchProjeto, agora: string) {
  const corpo: Record<string, unknown> = { atualizado_em: agora }
  if (patch.nome !== undefined) corpo.nome = patch.nome
  if (patch.data !== undefined) corpo.data = patch.data
  if (patch.atualizadoPor !== undefined) corpo.atualizado_por = patch.atualizadoPor
  if (patch.arquivoNome !== undefined) {
    corpo.arquivo_nome = patch.arquivoNome
    corpo.arquivo_caminho = patch.arquivoNome ? `${id}.xlsx` : null
  }
  if (patch.arquivoGeradoNome !== undefined) corpo.arquivo_gerado_nome = patch.arquivoGeradoNome
  if (patch.concluidoEm !== undefined) corpo.concluido_em = patch.concluidoEm
  if (patch.concluidoPor !== undefined) corpo.concluido_por = patch.concluidoPor
  if (patch.capa !== undefined) corpo.capa = patch.capa
  if (patch.status !== undefined) corpo.status = patch.status
  if (patch.lancamentos !== undefined) corpo.lancamentos = patch.lancamentos
  return corpo
}

/** Só o JSON local. No Supabase, a exclusão do usuário cai na cascata já existente. */
export async function tirarParticipanteLocal(usuarioId: string) {
  if (supabaseConfigurado()) return
  if (!idSeguro(usuarioId)) return
  await alterarIndice((projetos) => {
    for (const projeto of projetos) {
      projeto.participantes = projeto.participantes.filter((item) => item !== usuarioId)
    }
  })
}

export async function inserirProjeto(projeto: Projeto) {
  if (!idSeguro(projeto.id)) throw new Error('Identificador inválido.')
  const completo = completarProjeto(projeto)
  if (!supabaseConfigurado()) {
    await alterarIndice((projetos) => {
      if (projetos.some((item) => item.id === completo.id)) return
      projetos.push(completo)
    })
    return
  }
  await inserirLinha('projetos', linhaDe(completo), 'id')
  try {
    for (const usuarioId of completo.participantes) {
      if (!idSeguro(usuarioId)) throw new Error('Participante inválido.')
      await inserirLinha(
        'projeto_participantes',
        { projeto_id: completo.id, usuario_id: usuarioId },
        'projeto_id,usuario_id',
      )
    }
  } catch (erro) {
    await apagarOnde('projetos', `id=eq.${completo.id}`).catch(() => undefined)
    throw erro
  }
}

/**
 * Grava só esta linha. `vistoEm` é o `atualizado_em` lido antes, sem reformatar.
 * Devolve o valor que o banco gravou. Zero linhas com o projeto ainda lá é conflito.
 */
export async function gravarProjeto(id: string, vistoEm: string, patch: PatchProjeto): Promise<string> {
  if (!idSeguro(id) || !vistoEm) throw new Error('Projeto não encontrado.')
  const agora = new Date().toISOString()
  if (!supabaseConfigurado()) {
    return alterarIndice((projetos) => {
      const atual = projetos.find((item) => item.id === id)
      if (!atual) throw new Error('Projeto não encontrado.')
      if (atual.atualizadoEm !== vistoEm) throw new ProjetoDesatualizado()
      aplicarPatch(atual, patch, agora)
      return agora
    })
  }
  const linhas = await atualizarOnde<{ atualizado_em: string }>(
    'projetos',
    `id=eq.${id}&atualizado_em=eq.${encodeURIComponent(vistoEm)}&select=atualizado_em`,
    corpoDoPatch(id, patch, agora),
  )
  const gravado = linhas[0]?.atualizado_em
  if (gravado) return gravado
  const existe = await lerTabela<{ id: string }>('projetos', `select=id&id=eq.${id}&limit=1`)
  if (existe.length === 0) throw new Error('Projeto não encontrado.')
  throw new ProjetoDesatualizado()
}

export async function apagarProjeto(id: string) {
  if (!idSeguro(id)) return
  if (!supabaseConfigurado()) {
    await alterarIndice((projetos) => {
      const indice = projetos.findIndex((item) => item.id === id)
      if (indice >= 0) projetos.splice(indice, 1)
    })
    return
  }
  await apagarOnde('projetos', `id=eq.${id}`)
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
