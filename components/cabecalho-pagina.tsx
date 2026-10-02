import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function CabecalhoPagina({
  titulo,
  icone: Icone,
  children,
  acoes,
}: {
  titulo: string
  icone: LucideIcon
  children?: ReactNode
  acoes?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icone className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          {children ? <div className="mt-1 max-w-3xl text-sm text-muted-foreground">{children}</div> : null}
        </div>
      </div>
      {acoes}
    </div>
  )
}
