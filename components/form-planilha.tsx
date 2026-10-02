'use client'

import { Recado } from '@/components/recado'
import { AVISO_PLANILHA_GRANDE, LIMITE_PLANILHA } from '@/lib/planilha/limite'
import { useState, type FormEvent, type ReactNode } from 'react'

export function FormPlanilha({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>
  className?: string
  children: ReactNode
}) {
  const [erro, setErro] = useState('')

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    const arquivo = new FormData(evento.currentTarget).get('arquivo')
    if (!(arquivo instanceof File) || arquivo.size <= LIMITE_PLANILHA) {
      setErro('')
      return
    }
    evento.preventDefault()
    setErro(AVISO_PLANILHA_GRANDE)
  }

  return (
    <form action={action} className={className} onSubmit={aoEnviar}>
      {erro ? (
        <Recado tom="erro">{erro}</Recado>
      ) : null}
      {children}
    </form>
  )
}
