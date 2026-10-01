'use server'

import { requireAdmin } from '@/lib/auth/guard'
import { hashSenha } from '@/lib/auth/senha'
import { alterarStore, registrarNo, type Papel } from '@/lib/operacao/store'
import { alterarProjetos } from '@/lib/projetos/store'
import { redirect, unstable_rethrow } from 'next/navigation'

function voltar(texto: string, ok = false): never {
  const chave = ok ? 'ok' : 'erro'
  redirect(`/administracao?${chave}=${encodeURIComponent(texto)}`)
}

export async function decidirPedido(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const acao = String(formData.get('acao') ?? '')
  if (acao !== 'aprovar' && acao !== 'rejeitar') voltar('Ação inválida.')

  const erro = await alterarStore((store) => {
    const pedido = store.pedidos.find((item) => item.id === id)
    if (!pedido || pedido.situacao !== 'pendente') return 'Pedido não está pendente.'
    pedido.situacao = acao === 'aprovar' ? 'aprovado' : 'rejeitado'
    pedido.decididoEm = new Date().toISOString()
    pedido.decididoPor = admin.login
    registrarNo(store, {
      nivel: 'info',
      evento: acao === 'aprovar' ? 'USER_APPROVED' : 'USER_REJECTED',
      ator: admin.login,
      mensagem:
        acao === 'aprovar'
          ? `${admin.login} aprovou o pedido de ${pedido.nome}. A conta nasce quando ele criar o usuário aqui.`
          : `${admin.login} rejeitou o pedido de ${pedido.nome}.`,
      detalhe: { email: pedido.email },
    })
    return null
  })

  if (erro) voltar(erro)
  voltar(
    acao === 'aprovar'
      ? 'Pedido aprovado. Nenhum e-mail saiu: não há remetente. A pessoa fica em Aguardando primeiro acesso.'
      : 'Pedido rejeitado.',
    true,
  )
}

export async function reenviarNotificacao(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')

  const erro = await alterarStore((store) => {
    const pedido = store.pedidos.find((item) => item.id === id)
    if (!pedido || pedido.situacao !== 'aprovado') return 'Só dá para reenviar um pedido aprovado.'
    const usuario = store.usuarios.find(
      (item) => item.email != null && item.email.toLowerCase() === pedido.email.toLowerCase(),
    )
    const entrou =
      usuario != null &&
      store.logs.some((item) => item.evento === 'USER_LOGIN' && item.ator === usuario.login)
    if (entrou) return 'Esta pessoa já fez o primeiro acesso.'
    registrarNo(store, {
      nivel: 'alerta',
      evento: 'USER_NOTIFY_RESEND',
      ator: admin.login,
      mensagem: `${admin.login} tentou reenviar a confirmação para ${pedido.email}. Não há remetente, então nada saiu.`,
      detalhe: { email: pedido.email },
    })
    return null
  })

  if (erro) voltar(erro)
  voltar(
    'Não reenviei. A aprovação não enviou e-mail: não há remetente ligado. A mensagem não chegou na caixa porque ela não partiu daqui.',
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
  if (senha.length < 8) voltar('A senha precisa de ao menos 8 caracteres.')
  if (senha !== senha2) voltar('A senha nova e a repetição não são iguais.')
  return senha
}

function loginInformado(bruto: string) {
  const login = bruto.trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,32}$/.test(login)) {
    voltar('O usuário usa 3 a 32 caracteres: letras, números, ponto, _ ou -.')
  }
  return login
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

  const erro = await alterarStore((store) => {
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
      senhaHash: hashSenha(senha),
      papel,
      ativo: true,
      origem: 'pedido',
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
    const erro = await alterarStore((store) => {
      const usuario = store.usuarios.find((item) => item.id === id)
      if (!usuario) return 'Usuário não encontrado.'
      usuario.senhaHash = hashSenha(senha)
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
