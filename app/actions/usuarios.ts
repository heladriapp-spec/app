'use server'

import { requireAdmin } from '@/lib/auth/guard'
import { enviarConfirmacao, enviarRecuperacao } from '@/lib/email/mensagem'
import { remetenteConfigurado } from '@/lib/email/smtp'
import { ehDiretiva } from '@/lib/acessos/regras'
import {
  atualizarConta,
  buscarUsuarioPublicoPorId,
  convidarConta,
  decidirPedidoOperacao,
  excluirConta,
  listarGrupos,
  prepararRecuperacao,
  reenviarConvite,
  registrarEvento,
  type SituacaoConta,
} from '@/lib/operacao/store'
import { redirect, unstable_rethrow } from 'next/navigation'

function voltar(texto: string, ok = false): never {
  const chave = ok ? 'ok' : 'erro'
  redirect(`/administracao?${chave}=${encodeURIComponent(texto)}`)
}

function avisoGravacao(erro: unknown) {
  if (erro instanceof Error && erro.message.trim()) return erro.message
  return 'Não foi possível gravar. Tente de novo.'
}

async function registrarFalha(ator: string, email: string, motivo: 'sem_remetente' | 'falha') {
  await registrarEvento({
    nivel: 'alerta',
    evento: 'EMAIL_FAILED',
    ator,
    mensagem:
      motivo === 'sem_remetente'
        ? `O e-mail para ${email} não saiu: o remetente não está configurado.`
        : `O e-mail para ${email} não saiu.`,
    detalhe: { email },
  })
}

export async function decidirPedido(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const acao = String(formData.get('acao') ?? '')
  if (acao !== 'aprovar' && acao !== 'rejeitar') voltar('Ação inválida.')

  const convite = { email: '', nome: '', token: '' }
  try {
    const resultado = await decidirPedidoOperacao(id, acao, admin.login)
    if (resultado.erro) voltar(resultado.erro)
    convite.email = resultado.email
    convite.nome = resultado.nome
    convite.token = resultado.token
  } catch (error) {
    unstable_rethrow(error)
    voltar(avisoGravacao(error))
  }

  if (!convite.token) voltar('Pedido rejeitado.', true)

  const envio = await enviarConfirmacao(convite.email, convite.nome, convite.token)
  if (envio.ok) {
    voltar(`Pedido aprovado. O e-mail de confirmação saiu para ${convite.email}.`, true)
  }
  await registrarFalha(admin.login, convite.email, envio.motivo)
  voltar(
    envio.motivo === 'sem_remetente'
      ? 'Pedido aprovado. O e-mail não saiu: o remetente não está configurado. A mensagem não ficou retida.'
      : 'Pedido aprovado. O e-mail não saiu. Reenvie a notificação quando o remetente responder.',
  )
}

export async function reenviarNotificacao(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')

  const convite = { email: '', nome: '', token: '' }
  try {
    const resultado = await reenviarConvite(id, admin.login)
    if (resultado.erro) voltar(resultado.erro)
    convite.email = resultado.email
    convite.nome = resultado.nome
    convite.token = resultado.token
  } catch (error) {
    unstable_rethrow(error)
    voltar(avisoGravacao(error))
  }

  const envio = await enviarConfirmacao(convite.email, convite.nome, convite.token)
  if (envio.ok) voltar(`Confirmação reenviada para ${convite.email}.`, true)
  await registrarFalha(admin.login, convite.email, envio.motivo)
  voltar(
    envio.motivo === 'sem_remetente'
      ? 'Não reenviei. O remetente não está configurado. A mensagem não ficou retida.'
      : 'Não reenviei. O remetente não respondeu. Tente de novo.',
  )
}

export async function configurarUsuario(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const primeiroNome = String(formData.get('primeiroNome') ?? '').trim()
  const sobrenome = String(formData.get('sobrenome') ?? '').trim()
  const celular = String(formData.get('celular') ?? '').trim()
  const situacao = String(formData.get('situacao') ?? '') as SituacaoConta
  const gruposIds = formData.getAll('grupo').map((item) => String(item))

  if (primeiroNome.length < 2) voltar('O primeiro nome precisa de ao menos 2 caracteres.')
  if (situacao !== 'ativa' && situacao !== 'bloqueada' && situacao !== 'desativada') {
    voltar('Situação inválida.')
  }

  const erro = await atualizarConta(
    id,
    { primeiroNome, sobrenome, celular: celular || null, situacao, gruposIds },
    admin.login,
  )

  if (erro) voltar(erro)
  voltar('Configuração gravada.', true)
}

export async function criarUsuario(formData: FormData) {
  const admin = await requireAdmin()
  const primeiroNome = String(formData.get('primeiroNome') ?? '').trim()
  const sobrenome = String(formData.get('sobrenome') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const celular = String(formData.get('celular') ?? '').trim()
  const loginInformado = String(formData.get('login') ?? '').trim().toLowerCase()
  const grupoId = String(formData.get('grupoId') ?? '')
  const noExecutor = String(formData.get('executor') ?? '') === 'sim'
  const login = loginInformado || email
  if (primeiroNome.length < 2 || sobrenome.length < 2) voltar('Informe o primeiro nome e o sobrenome.')
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) voltar('Informe um e-mail válido.')
  if (celular.replace(/\D/g, '').length < 10) voltar('Informe o celular com DDD.')
  if (!/^[a-z0-9._@-]{1,120}$/.test(login)) voltar('O login só pode ter letras, números, ponto, _ e -.')
  const grupos = await listarGrupos()
  const grupo = grupos.find((item) => item.id === grupoId)
  if (!grupo?.diretiva || !ehDiretiva(grupo.diretiva)) voltar('Escolha um grupo que já tenha diretiva.')
  if (!remetenteConfigurado()) {
    voltar('O remetente não está configurado. O convite não foi criado.')
  }

  const convite = { email: '', nome: '', token: '' }
  try {
    const resultado = await convidarConta(
      { primeiroNome, sobrenome, email, celular, login, grupoId, noExecutor },
      admin.login,
    )
    if (resultado.erro) voltar(resultado.erro)
    convite.email = resultado.email
    convite.nome = resultado.nome
    convite.token = resultado.token
  } catch (error) {
    unstable_rethrow(error)
    voltar(avisoGravacao(error))
  }

  const envio = await enviarConfirmacao(convite.email, convite.nome, convite.token)
  if (envio.ok) voltar(`Convite enviado para ${convite.email}. A pessoa define a própria senha.`, true)
  await registrarFalha(admin.login, convite.email, envio.motivo)
  voltar(
    envio.motivo === 'sem_remetente'
      ? 'O convite foi criado, mas o e-mail não saiu. Reenvie a notificação.'
      : 'O convite foi criado, mas o e-mail não saiu. Reenvie a notificação.',
    true,
  )
}

export async function enviarLinkDeSenha(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const usuario = await buscarUsuarioPublicoPorId(id)
  if (!usuario?.email) voltar('Esta conta não tem e-mail. O link de senha não se aplica.')
  if (usuario.situacao !== 'ativa') voltar('Desbloqueie a conta antes de enviar o link de senha.')
  if (!remetenteConfigurado()) voltar('O remetente não está configurado. Nada foi enviado.')

  let token = ''
  try {
    token = await prepararRecuperacao(usuario.email)
  } catch (error) {
    unstable_rethrow(error)
    voltar('Não foi possível gerar o link. Tente de novo.')
  }
  if (!token) voltar('O link não foi gerado. A conta pode estar inativa ou já ter um link recente.')
  const envio = await enviarRecuperacao(usuario.email, token)
  if (envio.ok) voltar(`Link de senha enviado para ${usuario.email}.`, true)
  await registrarFalha(admin.login, usuario.email, envio.motivo)
  voltar('O link foi gerado, mas o e-mail não saiu.')
}

export async function excluirUsuario(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (id === admin.id) voltar('Você não pode excluir a conta com a qual está entrado.')

  const resultado = await excluirConta(id, admin.login)
  if (resultado.erro) voltar(resultado.erro)
  voltar(`Conta ${resultado.login} excluída.`, true)
}
