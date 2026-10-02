'use client'

import { Marca } from '@/components/marca'
import { Button } from '@/components/ui/button'

export default function ErroDaPagina({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 bg-background p-6">
      <Marca compacta />
      <h1 className="text-lg font-semibold">Não foi possível concluir</h1>
      <p className="text-sm text-muted-foreground">
        A ação parou antes de mostrar o aviso. Tente de novo. Se for o login, a tela volta a dizer
        se o usuário não existe ou se a senha está incorreta.
      </p>
      <Button type="button" onClick={() => reset()}>
        Tentar de novo
      </Button>
    </main>
  )
}
