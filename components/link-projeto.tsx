'use client'

import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useLinkStatus } from 'next/link'
import type { ReactNode } from 'react'

export function LinkProjeto({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  return (
    <Link href={href} className={className}>
      {children}
      <MarcaCarregando />
    </Link>
  )
}

function MarcaCarregando() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      Carregando
    </span>
  )
}
