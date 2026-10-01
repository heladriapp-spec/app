'use client'

import { Button } from '@/components/ui/button'

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
        {concluindo ? 'Gerando…' : 'Concluir e baixar'}
      </Button>
    </>
  )
}
