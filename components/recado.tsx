import { cn } from '@/lib/utils'
import { CircleAlert, CircleCheck } from 'lucide-react'
import type { ReactNode } from 'react'

export function Recado({ tom, children }: { tom: 'ok' | 'erro'; children: ReactNode }) {
  const erro = tom === 'erro'
  const Icone = erro ? CircleAlert : CircleCheck
  return (
    <p
      role={erro ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-sm',
        erro
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-emerald-300 bg-emerald-50 text-emerald-950',
      )}
    >
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}
