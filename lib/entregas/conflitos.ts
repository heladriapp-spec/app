import { AREAS_CRITICAS, entregaPorId } from '@/lib/entregas/catalogo'
import type {
  EntregaResolvida,
  NivelConflito,
  ParecerConflitos,
  StatusEntregaDecisao,
} from '@/lib/entregas/tipos'

const ORDEM_NIVEL: Record<NivelConflito, number> = {
  ok: 0,
  nao_verificavel: 1,
  alerta: 2,
  bloqueado: 3,
}

function pior(a: NivelConflito, b: NivelConflito): NivelConflito {
  return ORDEM_NIVEL[a] >= ORDEM_NIVEL[b] ? a : b
}

export function analisarFila(
  fila: EntregaResolvida[],
  porId: Map<string, { implantado: boolean; statusDecisao: StatusEntregaDecisao | null }>,
): ParecerConflitos {
  const itens = fila.map((item, indice) => {
    const motivos: string[] = []
    let nivel: NivelConflito = 'ok'

    for (const depId of item.dependsOn) {
      const dep = porId.get(depId)
      const depCatalogo = entregaPorId(depId)
      if (!depCatalogo) {
        motivos.push(`Dependência ${depId} não está no catálogo.`)
        nivel = pior(nivel, 'nao_verificavel')
        continue
      }
      const depNaFila = fila.findIndex((row) => row.id === depId)
      const depOk =
        depCatalogo.implantado ||
        dep?.statusDecisao === 'aprovado' ||
        (depNaFila >= 0 && depNaFila < indice)

      if (dep?.statusDecisao === 'rollback') {
        motivos.push(
          `Depende de “${depCatalogo.nome}”, que está fora da fila. Não dá para aprovar nesta ordem.`,
        )
        nivel = pior(nivel, 'bloqueado')
      } else if (!depOk) {
        motivos.push(
          `Depende de “${depCatalogo.nome}”, que ainda não está implantada nem aprovada antes nesta fila.`,
        )
        nivel = pior(nivel, 'bloqueado')
      }
    }

    const anterior = indice > 0 ? fila[indice - 1] : null
    if (anterior) {
      const overlap = item.areas.filter(
        (area) => AREAS_CRITICAS.includes(area) && anterior.areas.includes(area),
      )
      if (overlap.length > 0) {
        motivos.push(
          `Em sequência com “${anterior.nome}” na mesma área crítica (${overlap.join(', ')}).`,
        )
        nivel = pior(nivel, 'alerta')
      }
    }

    if (item.major) {
      const depois = fila.slice(indice + 1)
      if (depois.some((row) => !row.major && row.dependsOn.length === 0)) {
        motivos.push('Entrega grande na fila: conferir se as seguintes ainda cabem antes dela.')
        nivel = pior(nivel, 'alerta')
      }
    }

    return { entregaId: item.id, nivel, motivos }
  })

  const nivel = itens.reduce<NivelConflito>((acc, item) => pior(acc, item.nivel), 'ok')
  return { nivel, ordemAnalisada: fila.map((item) => item.id), itens }
}

export function parecerDaEntrega(parecer: ParecerConflitos, entregaId: string) {
  return parecer.itens.find((item) => item.entregaId === entregaId) ?? null
}
