import type { ReactNode } from 'react'

export function AuthShell({
  titulo,
  children,
}: {
  titulo: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <p className="text-sm font-semibold">Heladri</p>
      <p className="text-xs text-muted-foreground">Planilha de licitação do SESC</p>
      <h1 className="mt-6 text-xl font-semibold">{titulo}</h1>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </main>
  )
}
