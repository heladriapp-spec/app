'use server'

import { entregaPorId } from '@/lib/entregas/catalogo'
import { parecerDaEntrega } from '@/lib/entregas/conflitos'
import { parecerDaFila, proximaPosicao, resolverEntregas } from '@/lib/entregas/estado'
import type { AcaoEntrega } from '@/lib/entregas/tipos'
import { requireAdmin } from '@/lib/auth/guard'
import { alterarStore, registrarNo } from '@/lib/operacao/store'
import { redirect } from 'next/navigation'

function destino(visao: string, texto: string, ok = false) {
  const chave = ok ? 'ok' : 'erro'
  const params = new URLSearchParams({ visao, [chave]: texto })
  redirect(`/administracao/implementacoes?${params.toString()}`)
}

export async function decidirEntrega(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const acao = String(formData.get('acao') ?? '') as AcaoEntrega
  const visao = String(formData.get('visao') ?? 'releases')
  const catalogo = entregaPorId(id)
  if (!catalogo) destino(visao, 'Entrega fora do catálogo.')
  if (acao !== 'aprovar' && acao !== 'rollback' && acao !== 'passar_frente') {
    destino(visao, 'Ação inválida.')
  }

  const erro = await alterarStore((store) => {
    const resolvidas = resolverEntregas(store.estados)
    const { parecer } = parecerDaFila(resolvidas)
    const item = resolvidas.find((row) => row.id === id)
    if (!item) return 'Entrega fora do catálogo.'
    const conflito = parecerDaEntrega(parecer, id)

    if (acao === 'aprovar') {
      if (item.implantado) return 'Esta entrega já está implantada.'
      if (item.statusDecisao === 'rollback') return 'Entrega fora da fila.'
      if (conflito?.nivel === 'bloqueado') {
        registrarNo(store, {
          nivel: 'alerta',
          evento: 'DELIVERY_BLOCKED',
          ator: admin.login,
          mensagem: `${admin.login} tentou aprovar “${item.nome}” e a fila bloqueou.`,
          detalhe: { entrega: id },
        })
        return conflito.motivos.join(' ')
      }
      gravar(store.estados, id, 'aprovado', item.posicao, admin.login)
      registrarNo(store, {
        nivel: 'info',
        evento: 'DELIVERY_APPROVED',
        ator: admin.login,
        mensagem: `${admin.login} aprovou “${item.nome}” para desenvolver. Não publica sozinho.`,
        detalhe: { entrega: id, versao: item.versaoPrevista },
      })
      return null
    }

    if (acao === 'passar_frente') {
      if (item.implantado || item.statusDecisao === 'rollback') return 'Esta entrega não está na fila.'
      const posicao = proximaPosicao(resolvidas)
      gravar(store.estados, id, 'adiado', posicao, admin.login)
      registrarNo(store, {
        nivel: 'info',
        evento: 'DELIVERY_DEFERRED',
        ator: admin.login,
        mensagem: `${admin.login} passou “${item.nome}” à frente.`,
        detalhe: { entrega: id },
      })
      return null
    }

    if (item.implantado) {
      gravar(store.estados, id, 'pedido_reversao', item.posicao, admin.login)
      registrarNo(store, {
        nivel: 'alerta',
        evento: 'DELIVERY_REVERT_REQUESTED',
        ator: admin.login,
        mensagem: `${admin.login} pediu reversão de “${item.nome}”. O código não é desfeito sozinho.`,
        detalhe: { entrega: id },
      })
      return null
    }

    gravar(store.estados, id, 'rollback', item.posicao, admin.login)
    registrarNo(store, {
      nivel: 'info',
      evento: 'DELIVERY_REVERT_REQUESTED',
      ator: admin.login,
      mensagem: `${admin.login} tirou “${item.nome}” da fila.`,
      detalhe: { entrega: id },
    })
    return null
  })

  if (erro) destino(visao, erro)
  destino(visao, 'Decisão registrada. A esteira recalcula o próximo passo.', true)
}

function gravar(
  estados: { entrega_id: string; status: 'aprovado' | 'rollback' | 'adiado' | 'pedido_reversao' | 'aguardando'; posicao: number | null; atualizado_por: string | null; atualizado_em: string }[],
  id: string,
  status: 'aprovado' | 'rollback' | 'adiado' | 'pedido_reversao',
  posicao: number | null,
  ator: string,
) {
  const atual = estados.find((item) => item.entrega_id === id)
  const linha = {
    entrega_id: id,
    status,
    posicao,
    atualizado_por: ator,
    atualizado_em: new Date().toISOString(),
  }
  if (atual) Object.assign(atual, linha)
  else estados.push(linha)
}
