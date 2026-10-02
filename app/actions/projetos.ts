'use server'

import { requireUser } from '@/lib/auth/guard'
import { pode } from '@/lib/projetos/acesso'
import { lerPlanilha } from '@/lib/planilha/ler'
import { AVISO_PLANILHA_GRANDE, LIMITE_PLANILHA } from '@/lib/planilha/limite'
import { dataHojeISO } from '@/lib/planilha/numeros'
import { lerLancamentosAnexo, lerLancamentosCotacao } from '@/lib/planilha/preenchimento'
import { registrarEventoProjeto } from '@/lib/projetos/eventos'
import { DOCUMENTO_SALVO, PROJETO_ENVIADO } from '@/lib/projetos/frases'
import {
  apagarArquivoDoProjeto,
  apagarArquivoGerado,
  apagarProjeto,
  aplicarPlanilha,
  gravarArquivoDoProjeto,
  gravarProjeto,
  inserirProjeto,
  planilhaDoProjeto,
  ProjetoDesatualizado,
  projetoPorId,
  TransicaoRecusada,
} from '@/lib/projetos/store'
import type { CotacaoLida } from '@/lib/planilha/cotacao'
import type { Projeto } from '@/lib/projetos/tipos'
import { registrarEvento } from '@/lib/operacao/store'
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
  const usuario = await requireUser()
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
  if (!upload) voltar('/projetos/novo', 'Escolha a planilha .xlsx do SESC.')

  const agora = new Date().toISOString()
  const id = crypto.randomUUID()
  const projeto: Projeto = {
    id,
    nome,
    data,
    criadoEm: agora,
    criadoPor: usuario.login,
    atualizadoEm: agora,
    atualizadoPor: usuario.login,
    participantes: [usuario.id],
    arquivoNome: null,
    arquivoGeradoNome: null,
    concluidoEm: null,
    concluidoPor: null,
    responsavelId: null,
    responsavelEm: null,
    submetidoEm: null,
    previaLiberada: false,
    capa: null,
    status: 'em_edicao',
    lancamentos: {},
  }
  aplicarPlanilha(projeto, upload.nome, upload.lida, usuario.login)

  let falha: unknown = null
  try {
    await inserirProjeto(projeto)
    await gravarArquivoDoProjeto(id, upload.buf)
  } catch (erro) {
    falha = erro
  }
  if (falha) {
    await apagarProjeto(id).catch(() => undefined)
    await apagarArquivoDoProjeto(id).catch(() => undefined)
    voltar(
      '/projetos/novo',
      falha instanceof Error ? falha.message : 'Não foi possível criar o projeto.',
    )
  }

  await registrarEvento({
    nivel: 'info',
    evento: 'PROJECT_CREATED',
    ator: usuario.login,
    mensagem: `${usuario.login} criou o projeto “${nome}”.`,
    detalhe: { projeto: id, planilha: true },
  })
  redirect(`/projetos/${id}`)
}

export async function removerProjeto(formData: FormData) {
  const usuario = await requireUser()
  const id = String(formData.get('id') ?? '')
  const projeto = await projetoPorId(id, { valores: false })
  if (!projeto) voltar('/', 'Projeto não encontrado.')
  if (!pode(usuario, projeto, 'excluir')) {
    voltar('/', 'Só dá para remover um projeto em preparação, e apenas quem o criou.')
  }

  await apagarArquivoDoProjeto(id)
  await apagarProjeto(id)
  await registrarEvento({
    nivel: 'info',
    evento: 'PROJECT_REMOVED',
    ator: usuario.login,
    mensagem: `${usuario.login} removeu o projeto “${projeto.nome}”.`,
    detalhe: { projeto: id },
  })
  voltar('/', `Projeto “${projeto.nome}” removido.`, true)
}

export async function carregarPlanilha(formData: FormData) {
  const usuario = await requireUser()
  const id = String(formData.get('id') ?? '')
  const projeto = await projetoPorId(id, { valores: false })
  if (!projeto || !pode(usuario, projeto, 'editar')) redirect('/')

  let upload: Awaited<ReturnType<typeof lerUpload>> = null
  try {
    upload = await lerUpload(formData)
  } catch (erro) {
    voltar(`/projetos/${id}`, erro instanceof Error ? erro.message : 'Não foi possível ler a planilha.')
  }
  if (!upload) voltar(`/projetos/${id}`, 'Escolha a planilha .xlsx do SESC.')

  let falha: unknown = null
  try {
    await gravarArquivoDoProjeto(id, upload.buf)
    await apagarArquivoGerado(id)
    await gravarProjeto(
      id,
      projeto.atualizadoEm,
      {
        arquivoNome: upload.nome,
        capa: upload.lida.capa,
        status: 'em_edicao',
        lancamentos: {},
        arquivoGeradoNome: null,
        concluidoEm: null,
        concluidoPor: null,
        atualizadoPor: usuario.login,
      },
      { status: 'em_edicao' },
    )
  } catch (erro) {
    falha = erro
  }
  if (falha) {
    voltar(
      `/projetos/${id}`,
      falha instanceof ProjetoDesatualizado || falha instanceof TransicaoRecusada
        ? falha.message
        : falha instanceof Error
          ? falha.message
          : 'Não foi possível guardar a planilha.',
    )
  }
  await registrarEvento({
    nivel: 'info',
    evento: 'PROJECT_FILE',
    ator: usuario.login,
    mensagem: `${usuario.login} carregou a planilha em “${projeto.nome}”.`,
    detalhe: { projeto: id },
  })
  redirect(`/projetos/${id}`)
}

export async function salvarPreenchimento(formData: FormData) {
  const usuario = await requireUser()
  const id = String(formData.get('id') ?? '')
  const projeto = await projetoPorId(id)
  if (!projeto || !pode(usuario, projeto, 'editar')) redirect('/')
  const submeter = String(formData.get('acao') ?? '') === 'submeter'
  if (submeter && !pode(usuario, projeto, 'submeter')) {
    voltar(`/projetos/${id}`, 'Este projeto ainda não tem planilha.')
  }
  const lida = await planilhaDoProjeto(projeto)
  if (!lida) voltar(`/projetos/${id}`, 'Este projeto ainda não tem planilha.')

  if (lida.formato === 'cotacao' && lida.cotacao) {
    await gravarCotacao(id, projeto, usuario.login, formData, lida.cotacao, submeter)
    return
  }

  const lido = lerLancamentosAnexo(formData, lida.linhas)
  if (!lido.ok) voltar(`/projetos/${id}`, lido.erro)
  await gravarLancamentos(id, projeto, usuario.login, lido.lancamentos, submeter)
}

async function gravarCotacao(
  id: string,
  projeto: Projeto,
  ator: string,
  formData: FormData,
  cotacao: CotacaoLida,
  submeter: boolean,
) {
  const lido = lerLancamentosCotacao(formData, cotacao)
  if (!lido.ok) voltar(`/projetos/${id}`, lido.erro)
  await gravarLancamentos(id, projeto, ator, lido.lancamentos, submeter)
}

async function gravarLancamentos(
  id: string,
  antes: Projeto,
  ator: string,
  lancamentos: Projeto['lancamentos'],
  submeter: boolean,
) {
  if (antes.status === 'concluido') {
    voltar(`/projetos/${id}`, 'Um projeto concluído não pode ser alterado.')
  }
  if (antes.status !== 'em_edicao') {
    voltar(`/projetos/${id}`, 'Este projeto já foi enviado.')
  }
  const agora = new Date().toISOString()
  try {
    await gravarProjeto(
      id,
      antes.atualizadoEm,
      {
        lancamentos,
        atualizadoPor: ator,
        ...(submeter ? { status: 'em_execucao' as const, submetidoEm: agora } : {}),
      },
      { status: 'em_edicao' },
    )
  } catch (erro) {
    if (erro instanceof ProjetoDesatualizado || erro instanceof TransicaoRecusada) {
      voltar(`/projetos/${id}`, erro.message)
    }
    if (erro instanceof Error && erro.message === 'Projeto não encontrado.') {
      voltar(`/projetos/${id}`, erro.message)
    }
    throw erro
  }
  if (submeter) {
    await registrarEventoProjeto({ projetoId: id, tipo: 'submetido', ator })
    voltar(`/projetos/${id}`, PROJETO_ENVIADO, true)
  }
  await registrarEvento({
    nivel: 'info',
    evento: 'PROJECT_SAVED',
    ator,
    mensagem: `${ator} gravou o preenchimento de “${antes.nome}”.`,
    detalhe: { projeto: id },
  })
  voltar(`/projetos/${id}`, DOCUMENTO_SALVO, true)
}
