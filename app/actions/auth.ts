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
import { acharLink, emitirLink, linkRecente, motivoDoLink, tokenInformado } from '@/lib/auth/links'
import { confereSenha, consumirTempoDeSenha, hashSenha } from '@/lib/auth/senha'
import { enviarRecuperacao } from '@/lib/email/mensagem'
import { remetenteConfigurado } from '@/lib/email/smtp'
import {
  alterarStore,
  buscarUsuarioParaLogin,
  registrarEvento,
  registrarNo,
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

  const erro = await alterarStore((store) => {
    const emailEmUso =
      store.usuarios.some((item) => item.email === email) ||
      store.pedidos.some((item) => item.email === email && item.situacao === 'pendente')
    if (emailEmUso) return 'Este e-mail já está em uma conta ou em um pedido pendente.'
    store.pedidos.push({
      id: crypto.randomUUID(),
      nome,
      email,
      celular,
      criadoEm: new Date().toISOString(),
      situacao: 'pendente',
      decididoEm: null,
      decididoPor: null,
    })
    registrarNo(store, {
      nivel: 'info',
      evento: 'USER_SIGNUP_REQUESTED',
      ator: null,
      mensagem: `${nome} pediu acesso.`,
      detalhe: { email },
    })
    return null
  })

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
    await alterarStore((store) => {
      registrarNo(store, {
        nivel: 'info',
        evento: 'PASSWORD_RECOVERY_REQUESTED',
        ator: null,
        mensagem: 'Alguém pediu recuperação de senha.',
        detalhe: { email },
      })
      const usuario = store.usuarios.find((item) => item.email === email && item.ativo)
      if (!usuario || linkRecente(store.links, 'senha', email)) return
      token = emitirLink(store.links, {
        tipo: 'senha',
        email,
        pedidoId: null,
        usuarioId: usuario.id,
      })
    })
  } catch (error) {
    unstable_rethrow(error)
    redirect('/esqueci-senha?ok=1')
  }

  if (token) {
    const envio = await enviarRecuperacao(email, token)
    if (!envio.ok) {
      await alterarStore((store) => {
        registrarNo(store, {
          nivel: 'alerta',
          evento: 'EMAIL_FAILED',
          ator: null,
          mensagem: `O e-mail de senha para ${email} não saiu.`,
          detalhe: { email },
        })
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
    const erro = await alterarStore(async (store) => {
      const link = acharLink(store.links, token)
      const motivo = motivoDoLink(link, 'confirmacao')
      if (motivo || !link) return motivo ?? 'Este link não vale.'
      const pedido = store.pedidos.find((item) => item.id === link.pedidoId)
      if (!pedido || pedido.situacao !== 'aprovado') return 'Este pedido não está aprovado.'
      if (store.usuarios.some((item) => item.login === login.login)) return 'Este usuário já existe.'
      if (store.usuarios.some((item) => item.email === link.email)) return 'Este e-mail já tem conta.'
      usuarioId = crypto.randomUUID()
      store.usuarios.push({
        id: usuarioId,
        nome: pedido.nome,
        email: link.email,
        celular: pedido.celular,
        login: login.login,
        senhaHash: await hashSenha(senha),
        papel: 'comum',
        ativo: true,
        origem: 'pedido',
        ocultarBoasVindas: false,
      })
      link.usadoEm = new Date().toISOString()
      registrarNo(store, {
        nivel: 'info',
        evento: 'USER_CONFIRMED',
        ator: login.login,
        mensagem: `${login.login} confirmou o acesso.`,
        detalhe: { email: link.email },
      })
      registrarNo(store, {
        nivel: 'info',
        evento: 'USER_LOGIN',
        ator: login.login,
        mensagem: `${login.login} entrou.`,
        detalhe: { papel: 'comum' },
      })
      return null
    })
    if (erro) redirect(`${destino}?erro=${encodeURIComponent(erro)}`)
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
  if (usuario && ocultar) {
    await alterarStore((store) => {
      const atual = store.usuarios.find((item) => item.id === usuario.id)
      if (atual) atual.ocultarBoasVindas = true
    })
  }
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
    const erro = await alterarStore(async (store) => {
      const link = acharLink(store.links, token)
      const motivo = motivoDoLink(link, 'senha')
      if (motivo || !link) return motivo ?? 'Este link não vale.'
      const usuario = store.usuarios.find((item) => item.id === link.usuarioId && item.email === link.email)
      if (!usuario || !usuario.ativo) return 'Esta conta não pode trocar a senha por este link.'
      usuario.senhaHash = await hashSenha(senha)
      link.usadoEm = new Date().toISOString()
      registrarNo(store, {
        nivel: 'info',
        evento: 'USER_PASSWORD_CHANGED',
        ator: usuario.login,
        mensagem: `${usuario.login} definiu uma senha nova pelo link.`,
        detalhe: { login: usuario.login },
      })
      return null
    })
    if (erro) redirect(`${destino}?erro=${encodeURIComponent(erro)}`)
  } catch (error) {
    unstable_rethrow(error)
    redirect(`${destino}?erro=${encodeURIComponent('Não foi possível gravar a senha. Tente de novo.')}`)
  }
  redirect(`/login?ok=${encodeURIComponent('Senha definida. Entre com a senha nova.')}`)
}
