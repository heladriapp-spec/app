'use client'

import { Download, FileDown, Loader2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'

export function NotaArquivoReferencial({
  nome,
  projetoId,
  gerado = false,
}: {
  nome: string | null
  projetoId: string
  gerado?: boolean
}) {
  if (!nome) return null
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <LinkArquivo href={`/api/projetos/${projetoId}/arquivo?papel=origem`}>
        <Download className="size-3.5 shrink-0 text-primary" aria-hidden />
        <span className="truncate">{nome}</span>
      </LinkArquivo>
      {gerado ? (
        <LinkArquivo href={`/api/projetos/${projetoId}/arquivo?papel=gerado`}>
          <FileDown className="size-3.5 shrink-0" aria-hidden />
          Planilha gerada
        </LinkArquivo>
      ) : null}
    </p>
  )
}

function LinkArquivo({ href, children }: { href: string; children: ReactNode }) {
  const [carregando, setCarregando] = useState(false)

  async function aoClicar(evento: React.MouseEvent<HTMLAnchorElement>) {
    evento.preventDefault()
    if (carregando) return
    setCarregando(true)
    try {
      const resposta = await fetch(href)
      if (!resposta.ok) return
      const blob = await resposta.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = nomeDoCabecalho(resposta.headers.get('Content-Disposition'))
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <a
      href={href}
      onClick={(evento) => void aoClicar(evento)}
      className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
    >
      {carregando ? (
        <>
          <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden />
          Carregando
        </>
      ) : (
        children
      )}
    </a>
  )
}

function nomeDoCabecalho(bruto: string | null) {
  if (!bruto) return 'planilha.xlsx'
  const estrela = /filename\*=UTF-8''([^;]+)/i.exec(bruto)
  if (estrela?.[1]) return decodeURIComponent(estrela[1])
  const simples = /filename="([^"]+)"/.exec(bruto)
  return simples?.[1] || 'planilha.xlsx'
}
