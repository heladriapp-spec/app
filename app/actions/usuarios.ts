'use server'

import { requireAdmin } from '@/lib/auth/guard'
import { validarLogin, validarSenha } from '@/lib/auth/credencial'
import { enviarConfirmacao } from '@/lib/email/mensagem'
import {
  atualizarConta,
  criarConta,
  decidirPedidoOperacao,
  excluirConta,
  reenviarConvite,
  registrarEvento,
  trocarSenhaDaConta,
  type Papel,
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
  const nome = String(formData.get('nome') ?? '').trim()
  const celular = String(formData.get('celular') ?? '').trim()
  const papel = String(formData.get('papel') ?? '') as Papel
  const ativo = formData.get('ativo') === 'on'

  if (nome.length < 2) voltar('O nome precisa de ao menos 2 caracteres.')
  if (papel !== 'administrador' && papel !== 'comum') voltar('Papel inválido.')

  const erro = await atualizarConta(id, { nome, celular: celular || null, papel, ativo }, admin.login)

  if (erro) voltar(erro)
  voltar('Configuração gravada.', true)
}

function senhaInformada(formData: FormData) {
  const senha = String(formData.get('senha') ?? '')
  const senha2 = String(formData.get('senha2') ?? '')
  const erro = validarSenha(senha, senha2)
  if (erro) voltar(erro)
  return senha
}

function loginInformado(bruto: string) {
  const resultado = validarLogin(bruto)
  if (!resultado.ok) voltar(resultado.erro)
  return resultado.login
}

export async function criarUsuario(formData: FormData) {
  const admin = await requireAdmin()
  const nome = String(formData.get('nome') ?? '').trim()
  const emailBruto = String(formData.get('email') ?? '').trim().toLowerCase()
  const celular = String(formData.get('celular') ?? '').trim()
  const papel = String(formData.get('papel') ?? 'comum') as Papel
  const login = loginInformado(String(formData.get('login') ?? ''))
  const senha = senhaInformada(formData)
  if (nome.length < 2) voltar('O nome precisa de ao menos 2 caracteres.')
  if (papel !== 'administrador' && papel !== 'comum') voltar('Papel inválido.')
  const email = emailBruto || null
  if (email && !email.includes('@')) voltar('Informe um e-mail válido ou deixe em branco.')

  const erro = await criarConta(
    { nome, email, celular: celular || null, login, senha, papel },
    admin.login,
  )

  if (erro) voltar(erro)
  voltar(`Conta ${login} criada. A pessoa já pode entrar.`, true)
}

export async function alterarSenha(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const senha = senhaInformada(formData)

  try {
    const erro = await trocarSenhaDaConta(id, senha, admin.login)
    if (erro) voltar(erro)
  } catch (error) {
    unstable_rethrow(error)
    voltar('Não foi possível gravar a senha. Tente de novo.')
  }
  voltar('Senha alterada.', true)
}

export async function excluirUsuario(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (id === admin.id) voltar('Você não pode excluir a conta com a qual está entrado.')

  const resultado = await excluirConta(id, admin.login)
  if (resultado.erro) voltar(resultado.erro)
  voltar(`Conta ${resultado.login} excluída.`, true)
}
