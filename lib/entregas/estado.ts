import { CATALOGO_ENTREGAS } from '@/lib/entregas/catalogo'
import { analisarFila } from '@/lib/entregas/conflitos'
import type {
  EntregaEstadoRow,
  EntregaResolvida,
  StatusEntregaBase,
  StatusEntregaDecisao,
} from '@/lib/entregas/tipos'

const STATUS_LABEL: Record<StatusEntregaBase, string> = {
  validado_producao: 'Validado em produção',
  nesta_versao: 'Implantado em DEV',
  planejado: 'Planejado',
  proposto: 'Proposto',
  fora_de_escopo: 'Fora de escopo',
}

const DECISAO_LABEL: Record<StatusEntregaDecisao, string> = {
  aguardando: 'Aguardando aprovação',
  aprovado: 'Aprovado para desenvolver',
  rollback: 'Fora da fila',
  adiado: 'Passou à frente',
  pedido_reversao: 'Pedido de reversão',
}

export function rotuloStatus(item: EntregaResolvida) {
  if (item.statusDecisao === 'pedido_reversao' || item.statusDecisao === 'rollback') {
    return DECISAO_LABEL[item.statusDecisao]
  }
  if (item.implantadoVisual) return STATUS_LABEL[item.statusBase]
  if (item.statusDecisao) return DECISAO_LABEL[item.statusDecisao]
  return STATUS_LABEL[item.statusBase]
}

export function resolverEntregas(estados: EntregaEstadoRow[]): EntregaResolvida[] {
  const mapa = new Map(estados.map((row) => [row.entrega_id, row]))
  return CATALOGO_ENTREGAS.map((item) => {
    const estado = mapa.get(item.id)
    const statusDecisao = estado?.status ?? null
    const resolvida: EntregaResolvida = {
      ...item,
      statusDecisao,
      posicao: estado?.posicao ?? item.ordemPrioridade,
      statusExibicao: '',
      implantadoVisual: item.implantado && statusDecisao !== 'pedido_reversao',
    }
    resolvida.statusExibicao = rotuloStatus(resolvida)
    return resolvida
  })
}

export function filaProximas(resolvidas: EntregaResolvida[]): EntregaResolvida[] {
  const ativas = resolvidas.filter(
    (item) =>
      !item.implantado &&
      item.statusBase !== 'fora_de_escopo' &&
      item.statusDecisao !== 'rollback',
  )
  const adiadas = ativas
    .filter((item) => item.statusDecisao === 'adiado')
    .sort((a, b) => (a.posicao ?? 0) - (b.posicao ?? 0))
  const demais = ativas
    .filter((item) => item.statusDecisao !== 'adiado')
    .sort((a, b) => {
      const pa = a.posicao ?? a.ordemPrioridade
      const pb = b.posicao ?? b.ordemPrioridade
      if (pa !== pb) return pa - pb
      return a.ordemPrioridade - b.ordemPrioridade
    })
  return [...demais, ...adiadas]
}

export function implantadas(resolvidas: EntregaResolvida[]): EntregaResolvida[] {
  return resolvidas
    .filter((item) => item.implantadoVisual)
    .sort((a, b) => {
      const va = a.versaoEfetiva ?? ''
      const vb = b.versaoEfetiva ?? ''
      if (va !== vb) return vb.localeCompare(va, undefined, { numeric: true })
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
}

export function parecerDaFila(resolvidas: EntregaResolvida[]) {
  const fila = filaProximas(resolvidas)
  const porId = new Map(
    resolvidas.map((item) => [
      item.id,
      { implantado: item.implantadoVisual, statusDecisao: item.statusDecisao },
    ]),
  )
  return { fila, parecer: analisarFila(fila, porId) }
}

export function proximaPosicao(resolvidas: EntregaResolvida[]) {
  const fila = filaProximas(resolvidas)
  const max = fila.reduce((acc, item) => Math.max(acc, item.posicao ?? 0), 0)
  return max + 10
}
