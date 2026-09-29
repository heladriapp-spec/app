import { VERSAO_APP, shaDoBuild } from '@/lib/versao'
import { cn } from '@/lib/utils'

export function AppVersao({ className }: { className?: string }) {
  const sha = shaDoBuild()
  return (
    <span
      className={cn('font-mono text-xs tabular-nums', className)}
      title={`Versão ${VERSAO_APP} · commit ${sha}`}
    >
      v{VERSAO_APP} · {sha}
    </span>
  )
}
