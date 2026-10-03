'use client'

import { Button } from '@/components/ui/button'
import { DOCUMENTO_SALVO } from '@/lib/projetos/frases'
import { CircleCheck, Loader2, Save, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'

const FRASE_MS = 1600

export function BotaoSalvar({ salvo = false, disabled = false }: { salvo?: boolean; disabled?: boolean }) {
  const { pending, data } = useFormStatus()
  const enviando = pending && data?.get('acao') === 'salvar'
  const [frase, setFrase] = useState(false)

  useEffect(() => {
    if (!salvo) return
    setFrase(true)
    const timer = window.setTimeout(() => setFrase(false), FRASE_MS)
    return () => window.clearTimeout(timer)
  }, [salvo])

  const texto = enviando ? 'Salvando' : frase ? DOCUMENTO_SALVO : 'Salvar'

  return (
    <Button
      type="submit"
      name="acao"
      value="salvar"
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

export function BotaoSubmeter({ disabled = false }: { disabled?: boolean }) {
  const { pending, data } = useFormStatus()
  const enviando = pending && data?.get('acao') === 'submeter'

  return (
    <Button type="submit" name="acao" value="submeter" data-aviso="silencioso" disabled={disabled || pending}>
      {enviando ? (
        <Loader2 className="animate-spin" data-icon="inline-start" />
      ) : (
        <Send data-icon="inline-start" />
      )}
      {enviando ? 'Enviando projeto para execução' : 'Submeter para execução'}
    </Button>
  )
}

export function BotaoConcluir({ disabled = false }: { disabled?: boolean }) {
  const { pending, data } = useFormStatus()
  const enviando = pending && data?.get('acao') === 'concluir'

  return (
    <Button type="submit" name="acao" value="concluir" data-aviso="silencioso" disabled={disabled || pending}>
      {enviando ? (
        <Loader2 className="animate-spin" data-icon="inline-start" />
      ) : (
        <CircleCheck data-icon="inline-start" />
      )}
      {enviando ? 'Concluindo' : 'Concluir'}
    </Button>
  )
}
