'use server'

import { confereSenha } from '@/lib/auth/senha'
import { gravarSessao, limparSessao, usuarioDaSessao } from '@/lib/auth/guard'
import { alterarStore, registrarNo } from '@/lib/operacao/store'
import { redirect } from 'next/navigation'

export async function entrar(formData: FormData) {
  const login = String(formData.get('login') ?? '').trim()
  const senha = String(formData.get('senha') ?? '')

  const resultado = await alterarStore((store) => {
    const usuario = store.usuarios.find((item) => item.login === login)
    if (!usuario || !confereSenha(senha, usuario.senhaHash)) {
      registrarNo(store, {
        nivel: 'alerta',
        evento: 'USER_LOGIN_FAILED',
        ator: null,
        mensagem: 'Tentativa de login recusada.',
        detalhe: { login },
      })
      return { ok: false as const, motivo: 'credencial' }
    }
    if (!usuario.ativo) {
      registrarNo(store, {
        nivel: 'alerta',
        evento: 'USER_LOGIN_FAILED',
        ator: usuario.login,
        mensagem: 'Conta desativada tentou entrar.',
        detalhe: { login },
      })
      return { ok: false as const, motivo: 'inativo' }
    }
    registrarNo(store, {
      nivel: 'info',
      evento: 'USER_LOGIN',
      ator: usuario.login,
      mensagem: `${usuario.login} entrou.`,
      detalhe: { papel: usuario.papel },
    })
    return { ok: true as const, id: usuario.id }
  })

  if (!resultado.ok) {
    const texto =
      resultado.motivo === 'inativo'
        ? 'Esta conta está desativada.'
        : 'Usuário ou senha não conferem.'
    redirect(`/login?erro=${encodeURIComponent(texto)}`)
  }

  await gravarSessao(resultado.id)
  redirect('/')
}

export async function sair() {
  const usuario = await usuarioDaSessao()
  if (usuario) {
    await alterarStore((store) => {
      registrarNo(store, {
        nivel: 'info',
        evento: 'USER_LOGOUT',
        ator: usuario.login,
        mensagem: `${usuario.login} saiu.`,
        detalhe: {},
      })
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
  await alterarStore((store) => {
    registrarNo(store, {
      nivel: 'info',
      evento: 'PASSWORD_RECOVERY_REQUESTED',
      ator: null,
      mensagem: 'Alguém pediu recuperação de senha.',
      detalhe: { email },
    })
  })
  redirect('/esqueci-senha?ok=1')
}
