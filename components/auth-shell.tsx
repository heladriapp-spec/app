import type { ReactNode } from 'react'

export function AuthShell({
  titulo,
  children,
}: {
  titulo: string
  children: ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card px-6 py-8 shadow-sm">
        <p className="text-sm font-semibold">Heladri</p>
        <p className="text-xs text-muted-foreground">Planilha de licitação do SESC</p>
        <h1 className="mt-6 text-xl font-semibold">{titulo}</h1>
        <div className="mt-4 flex flex-col gap-4">{children}</div>
      </div>
    </main>
  )
}
