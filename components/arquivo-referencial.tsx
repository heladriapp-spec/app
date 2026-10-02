import { buttonVariants } from '@/components/ui/button'
import { dataHoraBR } from '@/lib/formato'
import type { Projeto } from '@/lib/projetos/tipos'
import { Download, FileDown } from 'lucide-react'

export function ArquivoReferencial({
  projeto,
}: {
  projeto: Pick<
    Projeto,
    'id' | 'arquivoNome' | 'arquivoGeradoNome' | 'status' | 'concluidoEm' | 'concluidoPor'
  >
}) {
  if (!projeto.arquivoNome) return null
  return (
    <section className="rounded-lg border p-4">
      <h2 className="text-sm font-medium">Arquivo referencial</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Este projeto está amarrado à planilha{' '}
        <span className="font-medium text-foreground">{projeto.arquivoNome}</span>. O banco guarda
        os dados do preenchimento. Na conclusão, esses dados voltam para uma cópia fiel desse
        arquivo.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`/api/projetos/${projeto.id}/arquivo?papel=origem`}
          className={buttonVariants({ variant: 'outline' })}
        >
          <Download data-icon="inline-start" />
          Baixar original
        </a>
        {projeto.status === 'concluido' && projeto.arquivoGeradoNome ? (
          <a href={`/api/projetos/${projeto.id}/arquivo?papel=gerado`} className={buttonVariants()}>
            <FileDown data-icon="inline-start" />
            Baixar planilha gerada
          </a>
        ) : null}
      </div>
      {projeto.status === 'concluido' && projeto.concluidoEm ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Gerada {dataHoraBR(projeto.concluidoEm)}
          {projeto.concluidoPor ? ` por ${projeto.concluidoPor}` : ''}.
        </p>
      ) : null}
    </section>
  )
}

export function NotaArquivoReferencial({ nome }: { nome: string | null }) {
  if (!nome) return null
  return (
    <p className="text-sm text-muted-foreground">
      Arquivo referencial: <span className="font-medium text-foreground">{nome}</span>. Salvar
      rascunho guarda os dados. Concluir escreve esses dados de volta nesta planilha.
    </p>
  )
}
