'use server'

import { requireUser } from '@/lib/auth/guard'
import { lerPlanilha } from '@/lib/planilha/ler'
import { AVISO_PLANILHA_GRANDE, LIMITE_PLANILHA } from '@/lib/planilha/limite'
import { lancamentosIguais } from '@/lib/projetos/lancamento'
import { dataHojeISO } from '@/lib/planilha/numeros'
import { lerLancamentosAnexo, lerLancamentosCotacao } from '@/lib/planilha/preenchimento'
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

  const agora = new Date().toISOString()
  const id = crypto.randomUUID()
  const rascunho = String(formData.get('acao') ?? '') === 'rascunho'
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
    capa: null,
    status: rascunho ? 'rascunho' : 'sem_planilha',
    lancamentos: {},
  }
  if (upload) aplicarPlanilha(projeto, upload.nome, upload.lida, usuario.login, rascunho)

  let falha: unknown = null
  try {
    await inserirProjeto(projeto)
    if (upload) await gravarArquivoDoProjeto(id, upload.buf)
  } catch (erro) {
    falha = erro
  }
  if (falha) {
    await apagarProjeto(id).catch(() => undefined)
    if (upload) await apagarArquivoDoProjeto(id).catch(() => undefined)
    voltar(
      '/projetos/novo',
      falha instanceof Error ? falha.message : 'Não foi possível criar o projeto.',
    )
  }

  await registrarEvento({
    nivel: 'info',
    evento: 'PROJECT_CREATED',
    ator: usuario.login,
    mensagem: rascunho
      ? `${usuario.login} salvou o rascunho “${nome}”.`
      : `${usuario.login} criou o projeto “${nome}”.`,
    detalhe: { projeto: id, planilha: Boolean(upload), rascunho },
  })
  if (rascunho) redirect(`/projetos/${id}?ok=${encodeURIComponent('Documento salvo')}`)
  redirect(`/projetos/${id}`)
}

export async function removerProjeto(formData: FormData) {
  const usuario = await requireUser()
  const id = String(formData.get('id') ?? '')
  const projeto = await projetoPorId(id)
  if (!projeto) voltar('/', 'Projeto não encontrado.')
  if (!podeRemover(usuario, projeto)) voltar('/', 'Você só pode remover um projeto que você criou.')

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
  const projeto = await projetoPorId(id)
  if (!projeto || !podeLancar(usuario.id, usuario.papel, projeto)) redirect('/')

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
    await gravarProjeto(id, projeto.atualizadoEm, {
      arquivoNome: upload.nome,
      capa: upload.lida.capa,
      status: projeto.status === 'rascunho' ? 'rascunho' : 'em_preenchimento',
      lancamentos: {},
      arquivoGeradoNome: null,
      concluidoEm: null,
      concluidoPor: null,
      atualizadoPor: usuario.login,
    })
  } catch (erro) {
    falha = erro
  }
  if (falha) {
    voltar(
      `/projetos/${id}`,
      falha instanceof ProjetoDesatualizado
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
  if (!antes) voltar(`/projetos/${id}`, 'Projeto não encontrado.')
  const reabriu = Boolean(
    !rascunho && antes.status === 'concluido' && !lancamentosIguais(antes.lancamentos, lancamentos),
  )
  if (rascunho || reabriu) await apagarArquivoGerado(id)
  try {
    await gravarProjeto(id, antes.atualizadoEm, {
      lancamentos,
      atualizadoPor: ator,
      ...(rascunho
        ? { status: 'rascunho' as const, arquivoGeradoNome: null, concluidoEm: null, concluidoPor: null }
        : {}),
      ...(reabriu
        ? { status: 'em_preenchimento' as const, arquivoGeradoNome: null, concluidoEm: null, concluidoPor: null }
        : {}),
    })
  } catch (erro) {
    if (erro instanceof ProjetoDesatualizado) voltar(`/projetos/${id}`, erro.message)
    if (erro instanceof Error && erro.message === 'Projeto não encontrado.') {
      voltar(`/projetos/${id}`, erro.message)
    }
    throw erro
  }
  await registrarEvento({
    nivel: 'info',
    evento: rascunho ? 'PROJECT_DRAFT' : 'PROJECT_SAVED',
    ator,
    mensagem: rascunho
      ? `${ator} salvou o rascunho de “${nome}”.`
      : `${ator} gravou o preenchimento de “${nome}”.`,
    detalhe: { projeto: id },
  })
  const aviso = rascunho
    ? 'Documento salvo'
    : reabriu
      ? 'Preenchimento gravado. O projeto voltou para em preenchimento.'
      : 'Preenchimento gravado.'
  voltar(`/projetos/${id}`, aviso, true)
}

function podeLancar(usuarioId: string, papel: string, projeto: Projeto) {
  return papel === 'administrador' || projeto.participantes.includes(usuarioId)
}

function podeRemover(usuario: { login: string; papel: string }, projeto: Projeto) {
  return usuario.papel === 'administrador' || projeto.criadoPor === usuario.login
}
