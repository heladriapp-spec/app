'use server'

import { requireUser } from '@/lib/auth/guard'
import { pode } from '@/lib/projetos/acesso'
import { aplicarPreenchimento } from '@/lib/planilha/gravar'
import { lerPlanilha } from '@/lib/planilha/ler'
import { AVISO_PLANILHA_GRANDE, LIMITE_PLANILHA } from '@/lib/planilha/limite'
import { dataHojeISO } from '@/lib/planilha/numeros'
import { lerLancamentosAnexo, lerLancamentosCotacao } from '@/lib/planilha/preenchimento'
import { itemDaPlanilha, preservarExcluidos, rotulosDaPlanilha } from '@/lib/projetos/estado'
import { registrarEventoProjeto } from '@/lib/projetos/eventos'
import {
  DOCUMENTO_SALVO,
  ITEM_FORA,
  ITEM_DE_VOLTA,
  PARTICIPANTE_INCLUIDO,
  PARTICIPANTE_REMOVIDO,
  PREVIA_LIBERADA,
  PREVIA_RECOLHIDA,
  PROJETO_ASSUMIDO,
  PROJETO_CONCLUIDO,
  PROJETO_DEVOLVIDO,
  PROJETO_ENVIADO,
  VERSAO_RESTAURADA,
} from '@/lib/projetos/frases'
import { estadoDaVersao, lancamentosRestaurados, registrarVersao } from '@/lib/projetos/historico'
import {
  apagarArquivoDoProjeto,
  apagarArquivoGerado,
  apagarProjeto,
  aplicarPlanilha,
  gravarArquivoDoProjeto,
  gravarArquivoGerado,
  gravarProjeto,
  lerArquivoDoProjeto,
  incluirParticipanteNoProjeto,
  inserirProjeto,
  planilhaDoProjeto,
  ProjetoDesatualizado,
  projetoPorId,
  removerParticipanteDoProjeto,
  TransicaoRecusada,
} from '@/lib/projetos/store'
import { buscarUsuarioPublicoPorId } from '@/lib/operacao/store'
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
  const acao = String(formData.get('acao') ?? '')
  const submeter = acao === 'submeter'
  const concluir = acao === 'concluir'
  if (submeter && !pode(usuario, projeto, 'submeter')) {
    voltar(
      `/projetos/${id}`,
      projeto.arquivoNome ? 'Este projeto já foi enviado.' : 'Este projeto ainda não tem planilha.',
    )
  }
  if (concluir && !pode(usuario, projeto, 'concluir')) {
    voltar(`/projetos/${id}`, 'Só o responsável conclui um projeto em execução.')
  }
  const modo = concluir ? 'concluir' : submeter ? 'submeter' : 'salvar'
  const lida = await planilhaDoProjeto(projeto)
  if (!lida) voltar(`/projetos/${id}`, 'Este projeto ainda não tem planilha.')

  const rotulos = rotulosDaPlanilha(lida)
  if (lida.formato === 'cotacao' && lida.cotacao) {
    await gravarCotacao(id, projeto, usuario.login, formData, lida.cotacao, modo, rotulos)
    return
  }

  const lido = lerLancamentosAnexo(formData, lida.linhas)
  if (!lido.ok) voltar(`/projetos/${id}`, lido.erro)
  await gravarLancamentos(id, projeto, usuario.login, lido.lancamentos, modo, rotulos)
}

export async function assumirProjeto(formData: FormData) {
  const usuario = await requireUser()
  const id = String(formData.get('id') ?? '')
  const destino = `/projetos/${id || ''}`
  const projeto = await projetoPorId(id, { valores: false })
  if (!projeto || !pode(usuario, projeto, 'assumir')) {
    voltar(id ? destino : '/', 'Este projeto não está na fila.')
  }
  const agora = new Date().toISOString()
  try {
    await gravarProjeto(
      id,
      projeto.atualizadoEm,
      {
        responsavelId: usuario.id,
        responsavelEm: agora,
        atualizadoPor: usuario.login,
      },
      { status: 'em_execucao', semResponsavel: true },
    )
  } catch (erro) {
    voltar(
      destino,
      erro instanceof ProjetoDesatualizado || erro instanceof TransicaoRecusada
        ? erro.message
        : 'Não foi possível assumir o projeto.',
    )
  }
  await registrarEventoProjeto({ projetoId: id, tipo: 'assumido', ator: usuario.login })
  await registrarEvento({
    nivel: 'info',
    evento: 'PROJECT_ASSUMED',
    ator: usuario.login,
    mensagem: `${usuario.login} assumiu “${projeto.nome}”.`,
    detalhe: { projeto: id },
  })
  voltar(destino, PROJETO_ASSUMIDO, true)
}

export async function alternarPrevia(formData: FormData) {
  const usuario = await requireUser()
  const id = String(formData.get('id') ?? '')
  const acao = String(formData.get('acao') ?? '')
  const destino = `/projetos/${id || ''}`
  const liberar = acao === 'liberar'
  const projeto = await projetoPorId(id, { valores: false })
  const permissao = liberar ? 'liberar_previa' : acao === 'recolher' ? 'recolher_previa' : null
  if (!projeto || !permissao || !pode(usuario, projeto, permissao)) {
    voltar(id ? destino : '/', 'A prévia não está disponível nesta etapa.')
  }
  try {
    await gravarProjeto(
      id,
      projeto.atualizadoEm,
      { previaLiberada: liberar, atualizadoPor: usuario.login },
      { status: 'em_execucao' },
    )
  } catch (erro) {
    voltar(
      destino,
      erro instanceof ProjetoDesatualizado || erro instanceof TransicaoRecusada
        ? erro.message
        : 'Não foi possível alterar a prévia.',
    )
  }
  await registrarEvento({
    nivel: 'info',
    evento: liberar ? 'PROJECT_PREVIEW_OPENED' : 'PROJECT_PREVIEW_CLOSED',
    ator: usuario.login,
    mensagem: liberar
      ? `${usuario.login} liberou a prévia de “${projeto.nome}”.`
      : `${usuario.login} recolheu a prévia de “${projeto.nome}”.`,
    detalhe: { projeto: id },
  })
  voltar(destino, liberar ? PREVIA_LIBERADA : PREVIA_RECOLHIDA, true)
}

export async function devolverProjeto(formData: FormData) {
  const usuario = await requireUser()
  const id = String(formData.get('id') ?? '')
  const destino = `/projetos/${id || ''}`
  const motivo = String(formData.get('motivo') ?? '').trim().replace(/\s+/g, ' ')
  const projeto = await projetoPorId(id, { valores: false })
  if (!projeto || !pode(usuario, projeto, 'devolver')) {
    voltar(id ? destino : '/', 'Só o responsável devolve um projeto em execução.')
  }
  if (motivo.length < 3) voltar(destino, 'Informe o motivo da devolução.')
  if (motivo.length > 400) voltar(destino, 'O motivo passa de 400 caracteres.')
  try {
    await gravarProjeto(
      id,
      projeto.atualizadoEm,
      {
        status: 'em_edicao',
        responsavelId: null,
        responsavelEm: null,
        previaLiberada: false,
        atualizadoPor: usuario.login,
      },
      { status: 'em_execucao' },
    )
  } catch (erro) {
    voltar(
      destino,
      erro instanceof ProjetoDesatualizado || erro instanceof TransicaoRecusada
        ? erro.message
        : 'Não foi possível devolver o projeto.',
    )
  }
  await registrarEventoProjeto({
    projetoId: id,
    tipo: 'devolvido',
    ator: usuario.login,
    detalhe: { motivo },
  })
  await registrarEvento({
    nivel: 'info',
    evento: 'PROJECT_RETURNED',
    ator: usuario.login,
    mensagem: `${usuario.login} devolveu “${projeto.nome}” para preparação.`,
    detalhe: { projeto: id },
  })
  const aindaVe = pode(
    usuario,
    { ...projeto, status: 'em_edicao', responsavelId: null, previaLiberada: false },
    'ver',
  )
  voltar(aindaVe ? destino : '/', PROJETO_DEVOLVIDO, true)
}

async function gravarCotacao(
  id: string,
  projeto: Projeto,
  ator: string,
  formData: FormData,
  cotacao: CotacaoLida,
  modo: 'salvar' | 'submeter' | 'concluir',
  rotulos: Record<string, string>,
) {
  const lido = lerLancamentosCotacao(formData, cotacao)
  if (!lido.ok) voltar(`/projetos/${id}`, lido.erro)
  await gravarLancamentos(id, projeto, ator, lido.lancamentos, modo, rotulos)
}

async function gravarLancamentos(
  id: string,
  antes: Projeto,
  ator: string,
  recebidos: Projeto['lancamentos'],
  modo: 'salvar' | 'submeter' | 'concluir',
  rotulos: Record<string, string>,
) {
  if (antes.status === 'concluido') {
    voltar(`/projetos/${id}`, 'Um projeto concluído não pode ser alterado.')
  }
  if (modo === 'submeter' && antes.status !== 'em_edicao') {
    voltar(`/projetos/${id}`, 'Este projeto já foi enviado.')
  }
  if (modo === 'concluir' && antes.status !== 'em_execucao') {
    voltar(`/projetos/${id}`, 'Só o responsável conclui um projeto em execução.')
  }
  if (modo === 'salvar' && antes.status !== 'em_edicao' && antes.status !== 'em_execucao') {
    voltar(`/projetos/${id}`, 'Este projeto já foi enviado.')
  }
  const lancamentos = preservarExcluidos(antes.lancamentos, recebidos)
  const agora = new Date().toISOString()
  const emExecucao = antes.status === 'em_execucao'
  let arquivoGeradoNome: string | null = null
  if (modo === 'concluir') {
    if (!antes.arquivoNome) voltar(`/projetos/${id}`, 'Este projeto ainda não tem planilha.')
    const lida = await planilhaDoProjeto(antes)
    if (!lida) voltar(`/projetos/${id}`, 'Este projeto ainda não tem planilha.')
    arquivoGeradoNome = antes.arquivoNome
    const gerado = aplicarPreenchimento(await lerArquivoDoProjeto(id), lida, lancamentos)
    await gravarArquivoGerado(id, gerado)
  }
  try {
    await gravarProjeto(
      id,
      antes.atualizadoEm,
      {
        lancamentos,
        atualizadoPor: ator,
        ...(modo === 'submeter' ? { status: 'em_execucao' as const, submetidoEm: agora } : {}),
        ...(modo === 'concluir'
          ? {
              status: 'concluido' as const,
              arquivoGeradoNome,
              concluidoEm: agora,
              concluidoPor: ator,
            }
          : {}),
      },
      { status: emExecucao ? 'em_execucao' : 'em_edicao' },
    )
  } catch (erro) {
    if (modo === 'concluir') await apagarArquivoGerado(id).catch(() => undefined)
    if (erro instanceof ProjetoDesatualizado || erro instanceof TransicaoRecusada) {
      voltar(`/projetos/${id}`, erro.message)
    }
    if (erro instanceof Error && erro.message === 'Projeto não encontrado.') {
      voltar(`/projetos/${id}`, erro.message)
    }
    throw erro
  }
  await registrarVersao({
    projetoId: id,
    ator,
    antes: antes.lancamentos,
    depois: lancamentos,
    rotulos,
  })
  if (modo === 'submeter') {
    await registrarEventoProjeto({ projetoId: id, tipo: 'submetido', ator })
    voltar(`/projetos/${id}`, PROJETO_ENVIADO, true)
  }
  if (modo === 'concluir') {
    await registrarEventoProjeto({ projetoId: id, tipo: 'concluido', ator })
    await registrarEvento({
      nivel: 'info',
      evento: 'PROJECT_CONCLUDED',
      ator,
      mensagem: `${ator} concluiu “${antes.nome}”.`,
      detalhe: { projeto: id },
    })
    voltar(`/projetos/${id}`, PROJETO_CONCLUIDO, true)
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

export async function excluirItem(formData: FormData) {
  await marcarItem(formData, true)
}

export async function reincluirItem(formData: FormData) {
  await marcarItem(formData, false)
}

async function marcarItem(formData: FormData, fora: boolean) {
  const usuario = await requireUser()
  const id = String(formData.get('id') ?? '')
  const item = String(formData.get('item') ?? '')
  const projeto = await projetoPorId(id)
  if (!projeto || !pode(usuario, projeto, 'excluir_item')) {
    voltar(`/projetos/${id || ''}`, 'Só o administrador que criou o projeto, em preparação, exclui um item.')
  }
  if (!/^[\w.:-]{1,80}$/.test(item)) voltar(`/projetos/${id}`, 'Item não encontrado.')
  const lida = await planilhaDoProjeto(projeto)
  if (!lida || !itemDaPlanilha(lida, item)) voltar(`/projetos/${id}`, 'Item não encontrado.')
  const atual = projeto.lancamentos[item]
  if (Boolean(atual?.excluido) === fora) {
    voltar(`/projetos/${id}`, fora ? 'Este item já está fora do trabalho.' : 'Este item já está no trabalho.')
  }
  const proximo: Projeto['lancamentos'][string] = {
    ...(atual ?? { quantidade: '', material: '', maoDeObra: '' }),
  }
  if (fora) proximo.excluido = true
  else delete proximo.excluido
  const lancamentos = { ...projeto.lancamentos, [item]: proximo }
  try {
    await gravarProjeto(
      id,
      projeto.atualizadoEm,
      { lancamentos, atualizadoPor: usuario.login },
      { status: 'em_edicao' },
    )
  } catch (erro) {
    if (erro instanceof ProjetoDesatualizado || erro instanceof TransicaoRecusada) {
      voltar(`/projetos/${id}`, erro.message)
    }
    throw erro
  }
  await registrarVersao({
    projetoId: id,
    ator: usuario.login,
    antes: projeto.lancamentos,
    depois: lancamentos,
    rotulos: rotulosDaPlanilha(lida),
  })
  voltar(`/projetos/${id}`, fora ? ITEM_FORA : ITEM_DE_VOLTA, true)
}

export async function restaurarVersao(formData: FormData) {
  const usuario = await requireUser()
  const id = String(formData.get('id') ?? '')
  const numero = Number(formData.get('numero') ?? '')
  const projeto = await projetoPorId(id)
  if (!projeto || !pode(usuario, projeto, 'restaurar')) {
    voltar(`/projetos/${id || ''}`, 'Só o administrador que criou o projeto, em preparação, restaura uma versão.')
  }
  const versao = await estadoDaVersao(id, numero)
  if (!versao) voltar(`/projetos/${id}`, 'Versão não encontrada.')
  const lida = await planilhaDoProjeto(projeto)
  const lancamentos = lancamentosRestaurados(projeto.lancamentos, versao.estado)
  try {
    await gravarProjeto(
      id,
      projeto.atualizadoEm,
      { lancamentos, atualizadoPor: usuario.login },
      { status: 'em_edicao' },
    )
  } catch (erro) {
    if (erro instanceof ProjetoDesatualizado || erro instanceof TransicaoRecusada) {
      voltar(`/projetos/${id}`, erro.message)
    }
    throw erro
  }
  await registrarVersao({
    projetoId: id,
    ator: usuario.login,
    antes: projeto.lancamentos,
    depois: lancamentos,
    rotulos: lida ? rotulosDaPlanilha(lida) : {},
    restauradaDe: numero,
  })
  voltar(`/projetos/${id}`, VERSAO_RESTAURADA, true)
}

export async function incluirParticipante(formData: FormData) {
  const usuario = await requireUser()
  const id = String(formData.get('id') ?? '')
  const usuarioId = String(formData.get('usuarioId') ?? '')
  const projeto = await projetoPorId(id, { valores: false })
  if (!projeto || !pode(usuario, projeto, 'gerir_participantes')) {
    voltar(`/projetos/${id || ''}`, 'Só o administrador inclui participante, e não num projeto concluído.')
  }
  const conta = await buscarUsuarioPublicoPorId(usuarioId)
  if (!conta || !conta.ativo) voltar(`/projetos/${id}`, 'Escolha uma conta ativa.')
  if (projeto.participantes.includes(conta.id)) voltar(`/projetos/${id}`, 'Essa pessoa já está no projeto.')
  await incluirParticipanteNoProjeto(id, conta.id)
  await registrarEventoProjeto({
    projetoId: id,
    tipo: 'participante_incluido',
    ator: usuario.login,
    detalhe: { usuarioId: conta.id, login: conta.login },
  })
  voltar(`/projetos/${id}`, PARTICIPANTE_INCLUIDO, true)
}

export async function removerParticipante(formData: FormData) {
  const usuario = await requireUser()
  const id = String(formData.get('id') ?? '')
  const usuarioId = String(formData.get('usuarioId') ?? '')
  const projeto = await projetoPorId(id, { valores: false })
  if (!projeto || !pode(usuario, projeto, 'gerir_participantes')) {
    voltar(`/projetos/${id || ''}`, 'Só o administrador remove participante, e não num projeto concluído.')
  }
  const conta = await buscarUsuarioPublicoPorId(usuarioId)
  if (!conta || !projeto.participantes.includes(conta.id)) {
    voltar(`/projetos/${id}`, 'Essa pessoa não está no projeto.')
  }
  if (conta.login === projeto.criadoPor) {
    voltar(`/projetos/${id}`, 'O autor do projeto permanece no projeto.')
  }
  await removerParticipanteDoProjeto(id, conta.id)
  await registrarEventoProjeto({
    projetoId: id,
    tipo: 'participante_removido',
    ator: usuario.login,
    detalhe: { usuarioId: conta.id, login: conta.login },
  })
  voltar(`/projetos/${id}`, PARTICIPANTE_REMOVIDO, true)
}
