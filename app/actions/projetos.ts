'use server'

import { requireAdmin, requireUser } from '@/lib/auth/guard'
import { lerPlanilha } from '@/lib/planilha/ler'
import { AVISO_PLANILHA_GRANDE, LIMITE_PLANILHA } from '@/lib/planilha/limite'
import { lancamentosIguais } from '@/lib/projetos/lancamento'
import { dataHojeISO } from '@/lib/planilha/numeros'
import { lerLancamentosAnexo, lerLancamentosCotacao } from '@/lib/planilha/preenchimento'
import {
  alterarProjetos,
  apagarArquivoDoProjeto,
  apagarArquivoGerado,
  aplicarPlanilha,
  gravarArquivoDoProjeto,
  limparConclusao,
  planilhaDoProjeto,
  projetoPorId,
} from '@/lib/projetos/store'
import type { CotacaoLida } from '@/lib/planilha/cotacao'
import type { Projeto } from '@/lib/projetos/tipos'
import { alterarStore, registrarNo } from '@/lib/operacao/store'
import { redirect } from 'next/navigation'

function voltar(caminho: string, texto: string, ok = false): never {
  const params = new URLSearchParams({ [ok ? 'ok' : 'erro']: texto })
  redirect(`${caminho}?${params.toString()}`)
}

function lerData(bruto: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bruto)) return null
  const [ano, mes, dia] = bruto.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
    return null
  }
  return bruto
}

async function lerUpload(formData: FormData) {
  const arquivo = formData.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) return null
  if (arquivo.size > LIMITE_PLANILHA) {
    throw new Error(AVISO_PLANILHA_GRANDE)
  }
  const nome = arquivo.name.split(/[/\\]/).pop()?.trim() || 'planilha.xlsx'
  if (!nome.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Envie a planilha .xlsx do SESC.')
  }
  const buf = Buffer.from(await arquivo.arrayBuffer())
  const lida = lerPlanilha(buf)
  return { nome, buf, lida }
}

export async function criarProjeto(formData: FormData) {
  const admin = await requireAdmin()
  const nome = String(formData.get('nome') ?? '').trim()
  const data = lerData(String(formData.get('data') ?? '').trim() || dataHojeISO())
  if (!nome) voltar('/projetos/novo', 'Informe o nome do projeto.')
  if (nome.length > 120) voltar('/projetos/novo', 'O nome do projeto passa de 120 caracteres.')
  if (!data) voltar('/projetos/novo', 'Informe a data do projeto.')

  let upload: Awaited<ReturnType<typeof lerUpload>> = null
  try {
    upload = await lerUpload(formData)
  } catch (erro) {
    voltar('/projetos/novo', erro instanceof Error ? erro.message : 'Não foi possível ler a planilha.')
  }

  const agora = new Date().toISOString()
  const id = crypto.randomUUID()
  const rascunho = String(formData.get('acao') ?? '') === 'rascunho'
  const projeto: Projeto = {
    id,
    nome,
    data,
    criadoEm: agora,
    criadoPor: admin.login,
    atualizadoEm: agora,
    atualizadoPor: admin.login,
    participantes: [admin.id],
    arquivoNome: null,
    arquivoGeradoNome: null,
    concluidoEm: null,
    concluidoPor: null,
    capa: null,
    status: rascunho ? 'rascunho' : 'sem_planilha',
    lancamentos: {},
  }
  if (upload) aplicarPlanilha(projeto, upload.nome, upload.lida, admin.login, rascunho)

  let falha: unknown = null
  try {
    await alterarProjetos((projetos) => {
      projetos.push(projeto)
    })
    if (upload) await gravarArquivoDoProjeto(id, upload.buf, upload.nome, admin.login)
  } catch (erro) {
    falha = erro
  }
  if (falha) {
    await alterarProjetos((projetos) => {
      const indice = projetos.findIndex((item) => item.id === id)
      if (indice >= 0) projetos.splice(indice, 1)
    }).catch(() => undefined)
    if (upload) await apagarArquivoDoProjeto(id).catch(() => undefined)
    voltar(
      '/projetos/novo',
      falha instanceof Error ? falha.message : 'Não foi possível criar o projeto.',
    )
  }

  await alterarStore((store) => {
    registrarNo(store, {
      nivel: 'info',
      evento: 'PROJECT_CREATED',
      ator: admin.login,
      mensagem: rascunho
        ? `${admin.login} salvou o rascunho “${nome}”.`
        : `${admin.login} criou o projeto “${nome}”.`,
      detalhe: { projeto: id, planilha: Boolean(upload), rascunho },
    })
  })
  redirect(`/projetos/${id}`)
}

export async function removerProjeto(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const projeto = await projetoPorId(id)
  if (!projeto) voltar('/', 'Projeto não encontrado.')

  await alterarProjetos(async (projetos) => {
    const indice = projetos.findIndex((item) => item.id === id)
    if (indice < 0) return
    await apagarArquivoDoProjeto(projetos[indice].id)
    projetos.splice(indice, 1)
  })
  await alterarStore((store) => {
    registrarNo(store, {
      nivel: 'info',
      evento: 'PROJECT_REMOVED',
      ator: admin.login,
      mensagem: `${admin.login} removeu o projeto “${projeto.nome}”.`,
      detalhe: { projeto: id },
    })
  })
  voltar('/', `Projeto “${projeto.nome}” removido.`, true)
}

export async function carregarPlanilha(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const projeto = await projetoPorId(id)
  if (!projeto) voltar('/', 'Projeto não encontrado.')

  let upload: Awaited<ReturnType<typeof lerUpload>> = null
  try {
    upload = await lerUpload(formData)
  } catch (erro) {
    voltar(`/projetos/${id}`, erro instanceof Error ? erro.message : 'Não foi possível ler a planilha.')
  }
  if (!upload) voltar(`/projetos/${id}`, 'Escolha a planilha .xlsx do SESC.')

  let falha: unknown = null
  try {
    await gravarArquivoDoProjeto(id, upload.buf, upload.nome, admin.login)
    await apagarArquivoGerado(id)
    await alterarProjetos((projetos) => {
      const atual = projetos.find((item) => item.id === id)
      if (!atual) return
      aplicarPlanilha(atual, upload.nome, upload.lida, admin.login, atual.status === 'rascunho')
    })
  } catch (erro) {
    falha = erro
  }
  if (falha) {
    voltar(
      `/projetos/${id}`,
      falha instanceof Error ? falha.message : 'Não foi possível guardar a planilha.',
    )
  }
  await alterarStore((store) => {
    registrarNo(store, {
      nivel: 'info',
      evento: 'PROJECT_FILE',
      ator: admin.login,
      mensagem: `${admin.login} carregou a planilha em “${projeto.nome}”.`,
      detalhe: { projeto: id },
    })
  })
  redirect(`/projetos/${id}`)
}

export async function salvarPreenchimento(formData: FormData) {
  const usuario = await requireUser()
  const id = String(formData.get('id') ?? '')
  const projeto = await projetoPorId(id)
  if (!projeto || !podeLancar(usuario.id, usuario.papel, projeto)) redirect('/')
  const lida = await planilhaDoProjeto(projeto)
  if (!lida) voltar(`/projetos/${id}`, 'Este projeto ainda não tem planilha.')

  if (lida.formato === 'cotacao' && lida.cotacao) {
    await gravarCotacao(id, projeto.nome, usuario.login, formData, lida.cotacao)
    return
  }

  const lido = lerLancamentosAnexo(formData, lida.linhas)
  if (!lido.ok) voltar(`/projetos/${id}`, lido.erro)
  await gravarLancamentos(id, projeto.nome, usuario.login, lido.lancamentos, formData.get('acao') === 'rascunho')
}

async function gravarCotacao(
  id: string,
  nome: string,
  ator: string,
  formData: FormData,
  cotacao: CotacaoLida,
) {
  const lido = lerLancamentosCotacao(formData, cotacao)
  if (!lido.ok) voltar(`/projetos/${id}`, lido.erro)
  await gravarLancamentos(id, nome, ator, lido.lancamentos, formData.get('acao') === 'rascunho')
}

async function gravarLancamentos(
  id: string,
  nome: string,
  ator: string,
  lancamentos: Projeto['lancamentos'],
  rascunho: boolean,
) {
  const antes = await projetoPorId(id)
  const reabriu = Boolean(
    !rascunho && antes?.status === 'concluido' && !lancamentosIguais(antes.lancamentos, lancamentos),
  )
  if (rascunho || reabriu) await apagarArquivoGerado(id)
  await alterarProjetos((projetos) => {
    const atual = projetos.find((item) => item.id === id)
    if (!atual) return
    atual.lancamentos = lancamentos
    atual.atualizadoEm = new Date().toISOString()
    atual.atualizadoPor = ator
    if (rascunho) {
      atual.status = 'rascunho'
      limparConclusao(atual)
    } else if (reabriu) {
      atual.status = 'em_preenchimento'
      limparConclusao(atual)
    }
  })
  await alterarStore((store) => {
    registrarNo(store, {
      nivel: 'info',
      evento: rascunho ? 'PROJECT_DRAFT' : 'PROJECT_SAVED',
      ator,
      mensagem: rascunho
        ? `${ator} salvou o rascunho de “${nome}”.`
        : `${ator} gravou o preenchimento de “${nome}”.`,
      detalhe: { projeto: id },
    })
  })
  const aviso = rascunho
    ? 'Rascunho gravado.'
    : reabriu
      ? 'Preenchimento gravado. O projeto voltou para em preenchimento.'
      : 'Preenchimento gravado.'
  voltar(`/projetos/${id}`, aviso, true)
}

function podeLancar(usuarioId: string, papel: string, projeto: Projeto) {
  return papel === 'administrador' || projeto.participantes.includes(usuarioId)
}
