'use server'

import { validarLogin, validarSenha } from '@/lib/auth/credencial'
import {
  gravarSessao,
  limparRecadoDeEntrada,
  limparSessao,
  marcarRecadoDeEntrada,
  usuarioDaSessao,
} from '@/lib/auth/guard'
import { ipDoCabecalho, limparFalhasDeLogin, loginBloqueado, registrarFalhaDeLogin } from '@/lib/auth/limite'
import { tokenInformado } from '@/lib/auth/links'
import { confereSenha, consumirTempoDeSenha } from '@/lib/auth/senha'
import { enviarRecuperacao } from '@/lib/email/mensagem'
import { remetenteConfigurado } from '@/lib/email/smtp'
import {
  buscarUsuarioParaLogin,
  confirmarConta,
  ocultarBoasVindasDaConta,
  prepararRecuperacao,
  registrarEvento,
  registrarPedido,
  trocarSenhaPeloLink,
  type UsuarioLogin,
} from '@/lib/operacao/store'
import { headers } from 'next/headers'
import { redirect, unstable_rethrow } from 'next/navigation'

const RECUSA = 'Usuário ou senha incorretos.'
const ESPERA = 'Muitas tentativas. Espere alguns minutos e tente de novo.'

export async function entrar(formData: FormData) {
  const login = String(formData.get('login') ?? '').trim().toLowerCase()
  const senha = String(formData.get('senha') ?? '')
  const recebidos = await headers()
  const ip = ipDoCabecalho(recebidos.get('x-forwarded-for'), recebidos.get('x-real-ip'))

  let entrou: { id: string; login: string; papel: UsuarioLogin['papel']; ocultarBoasVindas: boolean } | null =
    null
  try {
    if (await loginBloqueado(login, ip)) {
      await registrarEvento({
        nivel: 'alerta',
        evento: 'LOGIN_RATE_LIMITED',
        ator: null,
        mensagem: 'Tentativa de login recusada.',
        detalhe: { login },
      })
      redirect(`/login?erro=${encodeURIComponent(ESPERA)}`)
    }
    const usuario = await buscarUsuarioParaLogin(login)
    const senhaConfere = usuario
      ? await confereSenha(senha, usuario.senhaHash)
      : await consumirTempoDeSenha(senha).then(() => false)
    if (!usuario || !senhaConfere) {
      await registrarFalhaDeLogin(login, ip)
      await registrarEvento({
        nivel: 'alerta',
        evento: 'USER_LOGIN_FAILED',
        ator: null,
        mensagem: 'Tentativa de login recusada.',
        detalhe: { login },
      })
      redirect(`/login?erro=${encodeURIComponent(RECUSA)}`)
    }
    if (!usuario.ativo) {
      await registrarFalhaDeLogin(login, ip)
      await registrarEvento({
        nivel: 'alerta',
        evento: 'USER_LOGIN_FAILED',
        ator: usuario.login,
        mensagem: 'Conta desativada tentou entrar.',
        detalhe: { login },
      })
      redirect(`/login?erro=${encodeURIComponent(RECUSA)}`)
    }
    await limparFalhasDeLogin(login)
    entrou = {
      id: usuario.id,
      login: usuario.login,
      papel: usuario.papel,
      ocultarBoasVindas: usuario.ocultarBoasVindas,
    }
  } catch (error) {
    unstable_rethrow(error)
    const bruto = error instanceof Error ? error.message : 'falha sem mensagem'
    const texto = bruto.replace(/\s+/g, ' ').replace(/senha|token|secret|hash|bearer|chave/gi, '[omitido]').slice(0, 200)
    console.error(`[login] não foi possível concluir a entrada: ${texto}`)
    redirect(
      `/login?erro=${encodeURIComponent('Não foi possível entrar agora. Tente de novo.')}`,
    )
  }

  await gravarSessao(entrou.id)
  if (entrou.ocultarBoasVindas) await limparRecadoDeEntrada()
  else await marcarRecadoDeEntrada()
  await registrarEvento({
    nivel: 'info',
    evento: 'USER_LOGIN',
    ator: entrou.login,
    mensagem: `${entrou.login} entrou.`,
    detalhe: { papel: entrou.papel },
  })
  redirect('/')
}

export async function sair() {
  const usuario = await usuarioDaSessao()
  if (usuario) {
    await registrarEvento({
      nivel: 'info',
      evento: 'USER_LOGOUT',
      ator: usuario.login,
      mensagem: `${usuario.login} saiu.`,
      detalhe: {},
    })
  }
  await limparSessao()
  redirect('/login')
}

export async function pedirAcesso(formData: FormData) {
  const nome = String(formData.get('nome') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const celular = String(formData.get('celular') ?? '').trim()

  if (nome.length < 2 || !email.includes('@') || celular.replace(/\D/g, '').length < 10) {
    redirect(
      `/pedir-acesso?erro=${encodeURIComponent('Informe nome, e-mail válido e celular com DDD.')}`,
    )
  }

  const erro = await registrarPedido({ nome, email, celular })

  if (erro) redirect(`/pedir-acesso?erro=${encodeURIComponent(erro)}`)
  redirect('/pedir-acesso?ok=1')
}

export async function esqueciSenha(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!email.includes('@')) {
    redirect(`/esqueci-senha?erro=${encodeURIComponent('Informe o e-mail da conta.')}`)
  }
  if (!remetenteConfigurado()) {
    redirect(
      `/esqueci-senha?erro=${encodeURIComponent('O remetente não está configurado. Nada foi enviado.')}`,
    )
  }

  let token = ''
  try {
    token = await prepararRecuperacao(email)
  } catch (error) {
    unstable_rethrow(error)
    redirect('/esqueci-senha?ok=1')
  }

  if (token) {
    const envio = await enviarRecuperacao(email, token)
    if (!envio.ok) {
      await registrarEvento({
        nivel: 'alerta',
        evento: 'EMAIL_FAILED',
        ator: null,
        mensagem: `O e-mail de senha para ${email} não saiu.`,
        detalhe: { email },
      })
    }
  }
  redirect('/esqueci-senha?ok=1')
}

export async function confirmarAcesso(formData: FormData) {
  const token = tokenInformado(String(formData.get('token') ?? ''))
  if (!token) redirect('/login?erro=' + encodeURIComponent('Este link não vale.'))
  const destino = `/confirmar/${token}`
  const login = validarLogin(String(formData.get('login') ?? ''))
  if (!login.ok) redirect(`${destino}?erro=${encodeURIComponent(login.erro)}`)
  const senha = String(formData.get('senha') ?? '')
  const senhaErro = validarSenha(senha, String(formData.get('senha2') ?? ''))
  if (senhaErro) redirect(`${destino}?erro=${encodeURIComponent(senhaErro)}`)

  let usuarioId = ''
  try {
    const resultado = await confirmarConta({ token, login: login.login, senha })
    if (resultado.erro) redirect(`${destino}?erro=${encodeURIComponent(resultado.erro)}`)
    usuarioId = resultado.usuarioId
  } catch (error) {
    unstable_rethrow(error)
    redirect(`${destino}?erro=${encodeURIComponent('Não foi possível confirmar agora. Tente de novo.')}`)
  }

  await gravarSessao(usuarioId)
  await marcarRecadoDeEntrada()
  redirect('/')
}

export async function dispensarBoasVindas(formData: FormData) {
  const usuario = await usuarioDaSessao()
  const ocultar = formData.get('ocultar') === '1'
  if (usuario && ocultar) await ocultarBoasVindasDaConta(usuario.id)
  await limparRecadoDeEntrada()
}

export async function definirSenhaNova(formData: FormData) {
  const token = tokenInformado(String(formData.get('token') ?? ''))
  if (!token) redirect('/esqueci-senha?erro=' + encodeURIComponent('Este link não vale.'))
  const destino = `/nova-senha/${token}`
  const senha = String(formData.get('senha') ?? '')
  const senhaErro = validarSenha(senha, String(formData.get('senha2') ?? ''))
  if (senhaErro) redirect(`${destino}?erro=${encodeURIComponent(senhaErro)}`)

  try {
    const erro = await trocarSenhaPeloLink(token, senha)
    if (erro) redirect(`${destino}?erro=${encodeURIComponent(erro)}`)
  } catch (error) {
    unstable_rethrow(error)
    redirect(`${destino}?erro=${encodeURIComponent('Não foi possível gravar a senha. Tente de novo.')}`)
  }
  redirect(`/login?ok=${encodeURIComponent('Senha definida. Entre com a senha nova.')}`)
}
