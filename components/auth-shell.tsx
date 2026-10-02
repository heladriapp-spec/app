import { Marca } from '@/components/marca'
import { MarcaBlocos } from '@/components/marca-blocos'
import type { ReactNode } from 'react'

export function AuthShell({
  titulo,
  children,
}: {
  titulo: string
  children: ReactNode
}) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="campo-heladri filete-heladri relative hidden overflow-hidden lg:flex lg:min-h-dvh lg:flex-col lg:items-start lg:justify-between">
        <MarcaBlocos className="mt-14 ml-12 h-64 w-auto shrink-0 self-start text-primary" />
        <div className="px-12 pb-16">
          <img
            src="/marca/heladri.png"
            alt="Heladri cenografia"
            width={358}
            height={164}
            className="h-20 w-auto"
          />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/65">
            Portal para preencher a planilha de licitação do SESC.
          </p>
        </div>
      </section>

      <section className="flex min-h-dvh flex-col bg-background">
        <div className="campo-heladri filete-heladri px-6 py-5 lg:hidden">
          <Marca compacta />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
            <div className="mt-4 flex flex-col gap-4">{children}</div>
          </div>
        </div>
      </section>
    </main>
  )
}
