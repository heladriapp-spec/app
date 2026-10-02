import type { StatusProjeto } from '@/lib/projetos/tipos'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

const ETAPAS: Array<{ status: StatusProjeto; nome: string }> = [
  { status: 'em_edicao', nome: 'Preparação' },
  { status: 'em_execucao', nome: 'Execução' },
  { status: 'concluido', nome: 'Conclusão' },
]

export function ReguaProjeto({ status }: { status: StatusProjeto }) {
  const atual = Math.max(
    0,
    ETAPAS.findIndex((item) => item.status === status),
  )

  return (
    <ol aria-label="Etapa do projeto" className="flex flex-wrap gap-2">
      {ETAPAS.map((item, indice) => {
        const feita = indice < atual
        const corrente = indice === atual
        return (
          <li
            key={item.status}
            aria-current={corrente ? 'step' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm',
              corrente && 'border-primary bg-primary/10 font-medium text-foreground',
              feita && 'border-emerald-500/40 bg-emerald-50 text-emerald-950',
              !corrente && !feita && 'text-muted-foreground',
            )}
          >
            {feita ? <Check className="size-3.5" aria-hidden /> : null}
            <span className="text-xs tabular-nums opacity-60">{indice + 1}</span>
            {item.nome}
          </li>
        )
      })}
    </ol>
  )
}
