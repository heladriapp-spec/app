'use client'

import { Button } from '@/components/ui/button'
import { Loader2, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'

const FRASE_MS = 1600

export function BotaoRascunho({ salvo = false, disabled = false }: { salvo?: boolean; disabled?: boolean }) {
  const { pending, data } = useFormStatus()
  const enviando = pending && data?.get('acao') === 'rascunho'
  const [frase, setFrase] = useState(false)

  useEffect(() => {
    if (!salvo) return
    setFrase(true)
    const timer = window.setTimeout(() => setFrase(false), FRASE_MS)
    return () => window.clearTimeout(timer)
  }, [salvo])

  const texto = enviando ? 'Salvando' : frase ? 'Documento salvo' : 'Salvar rascunho'

  return (
    <Button
      type="submit"
      name="acao"
      value="rascunho"
      variant="outline"
      data-aviso="silencioso"
      disabled={disabled || pending}
    >
      {enviando ? (
        <Loader2 className="animate-spin" data-icon="inline-start" />
      ) : (
        <Save data-icon="inline-start" />
      )}
      {texto}
    </Button>
  )
}
