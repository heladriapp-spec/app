import { entregaPorId } from '@/lib/entregas/catalogo'
import { carregarResolvidas } from '@/lib/entregas/carregar'
import { enriquecerEntrega, GATES_ESTEIRA } from '@/lib/entregas/esteira'
import { parecerDaEntrega } from '@/lib/entregas/conflitos'
import { AREA_LABEL, GATE_STATUS_LABEL, TIPO_LABEL } from '@/lib/entregas/rotulos'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function EntregaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!entregaPorId(id)) notFound()
  const { resolvidas, parecer } = await carregarResolvidas()
  const item = resolvidas.find((row) => row.id === id)
  if (!item) notFound()
  const entrega = enriquecerEntrega(item, parecer)
  const conflito = parecerDaEntrega(parecer, id)

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/administracao/implementacoes?visao=releases" className="text-sm underline">
        Voltar às implantações
      </Link>
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline">{TIPO_LABEL[entrega.tipo]}</Badge>
        <Badge variant="secondary">{entrega.statusExibicao}</Badge>
      </div>
      <h1 className="text-xl font-semibold">{entrega.nome}</h1>
      <p className="text-sm text-muted-foreground">{entrega.resumo}</p>
      <p className="text-sm">
        Prevista {entrega.versaoPrevista}
        {entrega.versaoEfetiva ? ` · efetiva ${entrega.versaoEfetiva}` : ''}
      </p>
      <p className="text-sm text-muted-foreground">
        Áreas: {entrega.areas.map((area) => AREA_LABEL[area]).join(', ') || '—'}
      </p>
      <p className="text-sm">Próximo passo: {entrega.proximoPasso}</p>
      <p className="text-sm text-muted-foreground">Aprovação: {entrega.aprovacaoNecessaria}</p>
      {conflito && conflito.nivel !== 'ok' ? (
        <p className="text-sm text-muted-foreground">{conflito.motivos.join(' ')}</p>
      ) : null}
      <ol className="grid gap-2 sm:grid-cols-3">
        {GATES_ESTEIRA.map((gate) => {
          const estado = entrega.gates.find((itemGate) => itemGate.id === gate.id)?.status ?? 'pendente'
          return (
            <li key={gate.id} className="rounded-lg border p-3 text-sm">
              {gate.label}
              <span className="mt-1 block text-xs text-muted-foreground">
                {GATE_STATUS_LABEL[estado]}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
