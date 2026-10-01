'use server'

import { requireAdmin, requireUser } from '@/lib/auth/guard'
import { lerPlanilha } from '@/lib/planilha/ler'
import { dataHojeISO } from '@/lib/planilha/numeros'
import { lerLancamentosAnexo, lerLancamentosCotacao } from '@/lib/planilha/preenchimento'
import {
  alterarProjetos,
  apagarArquivoDoProjeto,
  aplicarPlanilha,
  gravarArquivoDoProjeto,
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
  if (arquivo.size > 8 * 1024 * 1024) {
    throw new Error('A planilha passa de 8 MB.')
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
    capa: null,
    status: 'sem_planilha',
    lancamentos: {},
  }
  if (upload) {
    await gravarArquivoDoProjeto(id, upload.buf)
    aplicarPlanilha(projeto, upload.nome, upload.lida, admin.login)
  }

  await alterarProjetos((projetos) => {
    projetos.push(projeto)
  })
  await alterarStore((store) => {
    registrarNo(store, {
      nivel: 'info',
      evento: 'PROJECT_CREATED',
      ator: admin.login,
      mensagem: `${admin.login} criou o projeto “${nome}”.`,
      detalhe: { projeto: id, planilha: Boolean(upload) },
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

  await gravarArquivoDoProjeto(id, upload.buf)
  await alterarProjetos((projetos) => {
    const atual = projetos.find((item) => item.id === id)
    if (!atual) return
    aplicarPlanilha(atual, upload.nome, upload.lida, admin.login)
  })
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
  const lancamentos = lido.lancamentos

  await alterarProjetos((projetos) => {
    const atual = projetos.find((item) => item.id === id)
    if (!atual) return
    atual.lancamentos = lancamentos
    atual.atualizadoEm = new Date().toISOString()
    atual.atualizadoPor = usuario.login
  })
  await alterarStore((store) => {
    registrarNo(store, {
      nivel: 'info',
      evento: 'PROJECT_SAVED',
      ator: usuario.login,
      mensagem: `${usuario.login} gravou o preenchimento de “${projeto.nome}”.`,
      detalhe: { projeto: id },
    })
  })
  voltar(`/projetos/${id}`, 'Preenchimento gravado.', true)
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
  const lancamentos = lido.lancamentos

  await alterarProjetos((projetos) => {
    const atual = projetos.find((item) => item.id === id)
    if (!atual) return
    atual.lancamentos = lancamentos
    atual.atualizadoEm = new Date().toISOString()
    atual.atualizadoPor = ator
  })
  await alterarStore((store) => {
    registrarNo(store, {
      nivel: 'info',
      evento: 'PROJECT_SAVED',
      ator,
      mensagem: `${ator} gravou o preenchimento de “${nome}”.`,
      detalhe: { projeto: id },
    })
  })
  voltar(`/projetos/${id}`, 'Preenchimento gravado.', true)
}

function podeLancar(usuarioId: string, papel: string, projeto: Projeto) {
  return papel === 'administrador' || projeto.participantes.includes(usuarioId)
}
