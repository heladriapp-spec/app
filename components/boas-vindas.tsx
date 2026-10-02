'use client'

import { dispensarBoasVindas } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { useEffect, useRef, useState } from 'react'

export function BoasVindas({ nome }: { nome: string }) {
  const [aberto, setAberto] = useState(true)
  const formRef = useRef<HTMLFormElement>(null)
  const interagiu = useRef(false)

  useEffect(() => {
    if (!aberto) return
    const timer = window.setTimeout(() => {
      if (interagiu.current) return
      formRef.current?.requestSubmit()
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [aberto])

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-background/60 px-4 pt-[12vh]">
      <form
        ref={formRef}
        action={dispensarBoasVindas}
        data-aviso="silencioso"
        className="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg"
        onSubmit={() => setAberto(false)}
        onFocus={() => {
          interagiu.current = true
        }}
        onPointerDown={() => {
          interagiu.current = true
        }}
      >
        <p className="text-sm leading-relaxed">
          Bem-vindo, {nome}. Com o Heladri você deixa a planilha manual de lado e preenche o trabalho do
          SESC aqui. O arquivo sai pronto.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" name="ocultar" value="1" className="size-4 accent-foreground" />
          Não mostrar de novo
        </label>
        <div className="mt-4 flex justify-end">
          <Button type="submit" variant="outline">
            Fechar
          </Button>
        </div>
      </form>
    </div>
  )
}
