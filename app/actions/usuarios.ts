'use server'

import { requireAdmin } from '@/lib/auth/guard'
import { alterarStore, registrarNo, type Papel } from '@/lib/operacao/store'
import { redirect } from 'next/navigation'

function voltar(texto: string, ok = false) {
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
          ? `${admin.login} aprovou o pedido de ${pedido.nome}. A conta nasce quando o e-mail de confirmação existir.`
          : `${admin.login} rejeitou o pedido de ${pedido.nome}.`,
      detalhe: { email: pedido.email },
    })
    return null
  })

  if (erro) voltar(erro)
  voltar(acao === 'aprovar' ? 'Pedido aprovado. A confirmação por e-mail está na fila.' : 'Pedido rejeitado.', true)
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
