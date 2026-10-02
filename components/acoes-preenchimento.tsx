'use client'

import { BotaoRascunho } from '@/components/botao-rascunho'
import { Button } from '@/components/ui/button'
import { Download, FileDown, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

const FRASE_MS = 1600

export function AcoesPreenchimento({
  salvo = false,
  onBaixar,
  onConcluir,
}: {
  salvo?: boolean
  onBaixar: (form: HTMLFormElement) => Promise<string | null>
  onConcluir: (form: HTMLFormElement) => Promise<string | null>
}) {
  const [qual, setQual] = useState<'baixar' | 'concluir' | null>(null)
  const [gerado, setGerado] = useState(false)

  useEffect(() => {
    if (!gerado) return
    const timer = window.setTimeout(() => {
      setGerado(false)
      setQual(null)
    }, FRASE_MS)
    return () => window.clearTimeout(timer)
  }, [gerado])

  const ocupado = qual != null && !gerado

  async function gerar(form: HTMLFormElement, concluir: boolean) {
    if (ocupado) return
    setGerado(false)
    setQual(concluir ? 'concluir' : 'baixar')
    try {
      const erro = concluir ? await onConcluir(form) : await onBaixar(form)
      if (erro) {
        setQual(null)
        return
      }
      setGerado(true)
    } catch {
      setQual(null)
    }
  }

  function texto(concluir: boolean) {
    const deste = qual === (concluir ? 'concluir' : 'baixar')
    if (deste && gerado) return 'Arquivo gerado'
    if (deste) return 'Gerando o arquivo'
    return concluir ? 'Concluir e baixar' : 'Baixar planilha'
  }

  return (
    <>
      <BotaoRascunho salvo={salvo} disabled={ocupado} />
      <Button
        type="button"
        variant="outline"
        disabled={ocupado}
        onClick={(evento) => {
          const form = evento.currentTarget.form
          if (form) void gerar(form, false)
        }}
      >
        {qual === 'baixar' && !gerado ? (
          <Loader2 className="animate-spin" data-icon="inline-start" />
        ) : (
          <Download data-icon="inline-start" />
        )}
        {texto(false)}
      </Button>
      <Button
        type="button"
        disabled={ocupado}
        onClick={(evento) => {
          const form = evento.currentTarget.form
          if (form) void gerar(form, true)
        }}
      >
        {qual === 'concluir' && !gerado ? (
          <Loader2 className="animate-spin" data-icon="inline-start" />
        ) : (
          <FileDown data-icon="inline-start" />
        )}
        {texto(true)}
      </Button>
    </>
  )
}
