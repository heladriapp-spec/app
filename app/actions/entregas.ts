'use server'

import { entregaPorId } from '@/lib/entregas/catalogo'
import { parecerDaEntrega } from '@/lib/entregas/conflitos'
import { parecerDaFila, proximaPosicao, resolverEntregas } from '@/lib/entregas/estado'
import type { AcaoEntrega, EntregaEstadoRow } from '@/lib/entregas/tipos'
import { requireAdmin } from '@/lib/auth/guard'
import { listarEstadosEntrega, registrarEvento, salvarEstadoEntrega, type EntradaLog } from '@/lib/operacao/store'
import { redirect } from 'next/navigation'

function destino(visao: string, texto: string, ok = false): never {
  const chave = ok ? 'ok' : 'erro'
  const params = new URLSearchParams({ visao, [chave]: texto })
  redirect(`/administracao/implementacoes?${params.toString()}`)
}

type EfeitoEntrega = {
  erro: string | null
  linha: EntregaEstadoRow | null
  evento: EntradaLog | null
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

  const efeito = efeitoDaDecisao(await listarEstadosEntrega(), id, acao, admin.login)
  if (efeito.linha) await salvarEstadoEntrega(efeito.linha)
  if (efeito.evento) await registrarEvento(efeito.evento)
  if (efeito.erro) destino(visao, efeito.erro)
  destino(visao, 'Decisão registrada. A esteira recalcula o próximo passo.', true)
}

function efeitoDaDecisao(estados: EntregaEstadoRow[], id: string, acao: AcaoEntrega, ator: string): EfeitoEntrega {
  const resolvidas = resolverEntregas(estados)
  const { parecer } = parecerDaFila(resolvidas)
  const item = resolvidas.find((row) => row.id === id)
  if (!item) return { erro: 'Entrega fora do catálogo.', linha: null, evento: null }
  const conflito = parecerDaEntrega(parecer, id)

  if (acao === 'aprovar') {
    if (item.implantado) return { erro: 'Esta entrega já está implantada.', linha: null, evento: null }
    if (item.statusDecisao === 'rollback') return { erro: 'Entrega fora da fila.', linha: null, evento: null }
    if (conflito?.nivel === 'bloqueado') {
      return {
        erro: conflito.motivos.join(' '),
        linha: null,
        evento: {
          nivel: 'alerta',
          evento: 'DELIVERY_BLOCKED',
          ator,
          mensagem: `${ator} tentou aprovar “${item.nome}” e a fila bloqueou.`,
          detalhe: { entrega: id },
        },
      }
    }
    return {
      erro: null,
      linha: linhaDe(id, 'aprovado', item.posicao, ator),
      evento: {
        nivel: 'info',
        evento: 'DELIVERY_APPROVED',
        ator,
        mensagem: `${ator} aprovou “${item.nome}” para desenvolver. Não publica sozinho.`,
        detalhe: { entrega: id, versao: item.versaoPrevista },
      },
    }
  }

  if (acao === 'passar_frente') {
    if (item.implantado || item.statusDecisao === 'rollback') {
      return { erro: 'Esta entrega não está na fila.', linha: null, evento: null }
    }
    return {
      erro: null,
      linha: linhaDe(id, 'adiado', proximaPosicao(resolvidas), ator),
      evento: {
        nivel: 'info',
        evento: 'DELIVERY_DEFERRED',
        ator,
        mensagem: `${ator} passou “${item.nome}” à frente.`,
        detalhe: { entrega: id },
      },
    }
  }

  if (item.implantado) {
    return {
      erro: null,
      linha: linhaDe(id, 'pedido_reversao', item.posicao, ator),
      evento: {
        nivel: 'alerta',
        evento: 'DELIVERY_REVERT_REQUESTED',
        ator,
        mensagem: `${ator} pediu reversão de “${item.nome}”. O código não é desfeito sozinho.`,
        detalhe: { entrega: id },
      },
    }
  }

  return {
    erro: null,
    linha: linhaDe(id, 'rollback', item.posicao, ator),
    evento: {
      nivel: 'info',
      evento: 'DELIVERY_REVERT_REQUESTED',
      ator,
      mensagem: `${ator} tirou “${item.nome}” da fila.`,
      detalhe: { entrega: id },
    },
  }
}

function linhaDe(
  id: string,
  status: 'aprovado' | 'rollback' | 'adiado' | 'pedido_reversao',
  posicao: number | null,
  ator: string,
): EntregaEstadoRow {
  return {
    entrega_id: id,
    status,
    posicao,
    atualizado_por: ator,
    atualizado_em: new Date().toISOString(),
  }
}
