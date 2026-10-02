import { Marca } from '@/components/marca'
import type { ReactNode } from 'react'

export function AuthShell({
  titulo,
  children,
}: {
  titulo: string
  children: ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/70 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border bg-card px-7 py-9 shadow-sm">
        <Marca />
        <h1 className="mt-6 text-xl font-semibold tracking-tight">{titulo}</h1>
        <div className="mt-4 flex flex-col gap-4">{children}</div>
      </div>
    </main>
  )
}
