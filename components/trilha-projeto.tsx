import { dataHoraBR } from '@/lib/formato'
import { fraseDaTrilha, type EventoProjeto } from '@/lib/projetos/eventos'

export function TrilhaProjeto({ eventos }: { eventos: EventoProjeto[] }) {
  if (eventos.length === 0) return null
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-medium">Histórico do fluxo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quem enviou, assumiu, devolveu e concluiu. Esta lista não guarda o formulário.
        </p>
      </div>
      <ol className="flex flex-col gap-2">
        {eventos.map((evento) => (
          <li key={evento.id} className="text-sm">
            <span className="text-muted-foreground">{dataHoraBR(evento.em)} · </span>
            {fraseDaTrilha(evento)}
          </li>
        ))}
      </ol>
    </section>
  )
}
