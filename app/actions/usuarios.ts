'use server'

import { requireAdmin } from '@/lib/auth/guard'
import { validarLogin, validarSenha } from '@/lib/auth/credencial'
import { emitirLink } from '@/lib/auth/links'
import { hashSenha } from '@/lib/auth/senha'
import { enviarConfirmacao } from '@/lib/email/mensagem'
import { alterarStore, registrarNo, type Papel } from '@/lib/operacao/store'
import { alterarProjetos } from '@/lib/projetos/store'
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
  await alterarStore((store) => {
    registrarNo(store, {
      nivel: 'alerta',
      evento: 'EMAIL_FAILED',
      ator,
      mensagem:
        motivo === 'sem_remetente'
          ? `O e-mail para ${email} não saiu: o remetente não está configurado.`
          : `O e-mail para ${email} não saiu.`,
      detalhe: { email },
    })
  })
}

export async function decidirPedido(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const acao = String(formData.get('acao') ?? '')
  if (acao !== 'aprovar' && acao !== 'rejeitar') voltar('Ação inválida.')

  const convite = { email: '', nome: '', token: '' }
  try {
    const erro = await alterarStore((store) => {
      const pedido = store.pedidos.find((item) => item.id === id)
      if (!pedido || pedido.situacao !== 'pendente') return 'Pedido não está pendente.'
      if (
        acao === 'aprovar' &&
        store.usuarios.some(
          (item) => item.email != null && item.email.toLowerCase() === pedido.email,
        )
      ) {
        return 'Este e-mail já tem conta.'
      }
      pedido.situacao = acao === 'aprovar' ? 'aprovado' : 'rejeitado'
      pedido.decididoEm = new Date().toISOString()
      pedido.decididoPor = admin.login
      if (acao === 'aprovar') {
        convite.email = pedido.email
        convite.nome = pedido.nome
        convite.token = emitirLink(store.links, {
          tipo: 'confirmacao',
          email: pedido.email,
          pedidoId: pedido.id,
          usuarioId: null,
        })
      }
      registrarNo(store, {
        nivel: 'info',
        evento: acao === 'aprovar' ? 'USER_APPROVED' : 'USER_REJECTED',
        ator: admin.login,
        mensagem:
          acao === 'aprovar'
            ? `${admin.login} aprovou o pedido de ${pedido.nome}. O link de confirmação segue para o e-mail.`
            : `${admin.login} rejeitou o pedido de ${pedido.nome}.`,
        detalhe: { email: pedido.email },
      })
      return null
    })
    if (erro) voltar(erro)
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
    const erro = await alterarStore((store) => {
      const pedido = store.pedidos.find((item) => item.id === id)
      if (!pedido || pedido.situacao !== 'aprovado') return 'Só dá para reenviar um pedido aprovado.'
      const usuario = store.usuarios.find(
        (item) => item.email != null && item.email.toLowerCase() === pedido.email.toLowerCase(),
      )
      if (usuario) return 'A conta deste e-mail já existe. O reenvio não cria outra.'
      convite.email = pedido.email
      convite.nome = pedido.nome
      convite.token = emitirLink(store.links, {
        tipo: 'confirmacao',
        email: pedido.email,
        pedidoId: pedido.id,
        usuarioId: null,
      })
      registrarNo(store, {
        nivel: 'info',
        evento: 'USER_NOTIFY_RESEND',
        ator: admin.login,
        mensagem: `${admin.login} reenviou a confirmação para ${pedido.email}.`,
        detalhe: { email: pedido.email },
      })
      return null
    })
    if (erro) voltar(erro)
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

  const erro = await alterarStore((store) => {
    const usuario = store.usuarios.find((item) => item.id === id)
    if (!usuario) return 'Usuário não encontrado.'
    const adminsDepois = store.usuarios.filter((item) => {
      if (item.id !== id) return item.papel === 'administrador' && item.ativo
      return papel === 'administrador' && ativo
    })
    if (adminsDepois.length === 0) {
      return 'O único administrador ativo não pode ser desativado nem rebaixado.'
    }
    usuario.nome = nome
    usuario.celular = celular || null
    usuario.papel = papel
    usuario.ativo = ativo
    registrarNo(store, {
      nivel: 'info',
      evento: 'USER_UPDATED',
      ator: admin.login,
      mensagem: `${admin.login} alterou ${usuario.login}.`,
      detalhe: { papel, ativo },
    })
    return null
  })

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

  const erro = await alterarStore(async (store) => {
    if (store.usuarios.some((item) => item.login === login)) {
      return 'Este usuário já existe.'
    }
    if (
      email &&
      (store.usuarios.some((item) => item.email === email) ||
        store.pedidos.some((item) => item.email === email && item.situacao === 'pendente'))
    ) {
      return 'Este e-mail já está em uma conta ou em um pedido pendente.'
    }
    store.usuarios.push({
      id: crypto.randomUUID(),
      nome,
      email,
      celular: celular || null,
      login,
      senhaHash: await hashSenha(senha),
      papel,
      ativo: true,
      origem: 'pedido',
      ocultarBoasVindas: false,
    })
    registrarNo(store, {
      nivel: 'info',
      evento: 'USER_CREATED',
      ator: admin.login,
      mensagem: `${admin.login} criou a conta ${login}.`,
      detalhe: { login, papel },
    })
    return null
  })

  if (erro) voltar(erro)
  voltar(`Conta ${login} criada. A pessoa já pode entrar.`, true)
}

export async function alterarSenha(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const senha = senhaInformada(formData)

  try {
    const erro = await alterarStore(async (store) => {
      const usuario = store.usuarios.find((item) => item.id === id)
      if (!usuario) return 'Usuário não encontrado.'
      usuario.senhaHash = await hashSenha(senha)
      registrarNo(store, {
        nivel: 'info',
        evento: 'USER_PASSWORD_CHANGED',
        ator: admin.login,
        mensagem: `${admin.login} definiu uma senha nova para ${usuario.login}.`,
        detalhe: { login: usuario.login },
      })
      return null
    })
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

  let login = ''
  const erro = await alterarStore((store) => {
    const usuario = store.usuarios.find((item) => item.id === id)
    if (!usuario) return 'Usuário não encontrado.'
    const adminsDepois = store.usuarios.filter(
      (item) => item.id !== id && item.papel === 'administrador' && item.ativo,
    )
    if (adminsDepois.length === 0) {
      return 'O único administrador ativo não pode ser excluído.'
    }
    login = usuario.login
    store.usuarios = store.usuarios.filter((item) => item.id !== id)
    registrarNo(store, {
      nivel: 'info',
      evento: 'USER_DELETED',
      ator: admin.login,
      mensagem: `${admin.login} excluiu a conta ${login}.`,
      detalhe: { login },
    })
    return null
  })

  if (erro) voltar(erro)
  await alterarProjetos((projetos) => {
    for (const projeto of projetos) {
      projeto.participantes = projeto.participantes.filter((item) => item !== id)
    }
  })
  voltar(`Conta ${login} excluída.`, true)
}
