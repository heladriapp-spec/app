'use client'

import { Button } from '@/components/ui/button'
import { Download, FileDown, Loader2, Save } from 'lucide-react'

export function AcoesPreenchimento({
  ocupado,
  baixando,
  concluindo,
  onBaixar,
  onConcluir,
}: {
  ocupado: boolean
  baixando: boolean
  concluindo: boolean
  onBaixar: (form: HTMLFormElement) => void
  onConcluir: (form: HTMLFormElement) => void
}) {
  return (
    <>
      <Button type="submit" name="acao" value="rascunho" variant="outline" disabled={ocupado}>
        <Save data-icon="inline-start" />
        Salvar rascunho
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={ocupado}
        onClick={(evento) => {
          const form = evento.currentTarget.form
          if (form) onBaixar(form)
        }}
      >
        {baixando ? (
          <Loader2 className="animate-spin" data-icon="inline-start" />
        ) : (
          <Download data-icon="inline-start" />
        )}
        {baixando ? 'Preparando…' : 'Baixar planilha'}
      </Button>
      <Button
        type="button"
        disabled={ocupado}
        onClick={(evento) => {
          const form = evento.currentTarget.form
          if (form) onConcluir(form)
        }}
      >
        {concluindo ? (
          <Loader2 className="animate-spin" data-icon="inline-start" />
        ) : (
          <FileDown data-icon="inline-start" />
        )}
        {concluindo ? 'Gerando…' : 'Concluir e baixar'}
      </Button>
    </>
  )
}
