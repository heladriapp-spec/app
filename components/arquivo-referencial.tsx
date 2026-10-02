import { Download, FileDown } from 'lucide-react'

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
      <a
        href={`/api/projetos/${projetoId}/arquivo?papel=origem`}
        className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
      >
        <Download className="size-3.5 shrink-0 text-primary" aria-hidden />
        <span className="truncate">{nome}</span>
      </a>
      {gerado ? (
        <a
          href={`/api/projetos/${projetoId}/arquivo?papel=gerado`}
          className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
        >
          <FileDown className="size-3.5 shrink-0" aria-hidden />
          Planilha gerada
        </a>
      ) : null}
    </p>
  )
}
