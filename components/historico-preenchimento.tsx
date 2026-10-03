import { restaurarVersao } from '@/app/actions/projetos'
import { Button } from '@/components/ui/button'
import { dataHoraBR } from '@/lib/formato'
import type { VersaoVisivel } from '@/lib/projetos/historico'

export function HistoricoPreenchimento({
  projetoId,
  versoes,
  podeRestaurar,
}: {
  projetoId: string
  versoes: VersaoVisivel[]
  podeRestaurar: boolean
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-medium">Versões do preenchimento</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada gravação que muda um campo vira uma versão. O arquivo não é copiado.
        </p>
      </div>
      {versoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma alteração gravada ainda.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {versoes.map((versao) => (
            <li key={versao.numero} className="rounded-xl border px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Versão {versao.numero}
                  {versao.atual ? ' · atual' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dataHoraBR(versao.em)} · {versao.ator}
                </p>
              </div>
              {versao.mudancas.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                  {versao.mudancas.map((linha, indice) => (
                    <li key={`${versao.numero}-${indice}`}>{linha}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Sem diferença de campo nesta versão.</p>
              )}
              {podeRestaurar && !versao.atual ? (
                <form action={restaurarVersao} className="mt-3">
                  <input type="hidden" name="id" value={projetoId} />
                  <input type="hidden" name="numero" value={versao.numero} />
                  <Button type="submit" variant="outline" size="sm">
                    Restaurar
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
