'use client'

import { Marca } from '@/components/marca'
import { Button } from '@/components/ui/button'

export default function ErroDaPagina({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 bg-background p-6">
      <Marca compacta />
      <h1 className="text-lg font-semibold">Erro inesperado</h1>
      <p className="text-sm text-muted-foreground">Consulte o administrador.</p>
      <Button type="button" onClick={() => reset()}>
        Tentar de novo
      </Button>
    </main>
  )
}
