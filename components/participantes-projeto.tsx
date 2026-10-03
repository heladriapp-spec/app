import { incluirParticipante, removerParticipante } from '@/app/actions/projetos'
import { Button } from '@/components/ui/button'
import { dataHoraBR } from '@/lib/formato'
import type { EntradaParticipante } from '@/lib/projetos/historico'

type Conta = { id: string; nome: string; login: string }

export function ParticipantesProjeto({
  projetoId,
  autorLogin,
  pessoas,
  candidatos,
  entradas,
  podeGerir,
}: {
  projetoId: string
  autorLogin: string
  pessoas: Conta[]
  candidatos: Conta[]
  entradas: EntradaParticipante[]
  podeGerir: boolean
}) {
  return (
    <section className="flex max-w-lg flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-medium">Pessoas no projeto</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quem sai deixa de abrir o projeto. O que já fez permanece no histórico.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {pessoas.map((pessoa) => {
          const autor = pessoa.login === autorLogin
          return (
            <li key={pessoa.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {pessoa.nome} <span className="text-muted-foreground">({pessoa.login})</span>
                {autor ? <span className="text-muted-foreground"> · autor</span> : null}
              </span>
              {podeGerir && !autor ? (
                <form action={removerParticipante}>
                  <input type="hidden" name="id" value={projetoId} />
                  <input type="hidden" name="usuarioId" value={pessoa.id} />
                  <Button type="submit" variant="outline" size="xs">
                    Remover
                  </Button>
                </form>
              ) : null}
            </li>
          )
        })}
      </ul>
      {podeGerir ? (
        <form action={incluirParticipante} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={projetoId} />
          <select
            name="usuarioId"
            required
            defaultValue=""
            aria-label="Conta para incluir"
            className="h-9 min-w-48 rounded-lg border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Incluir pessoa
            </option>
            {candidatos.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.nome} ({conta.login})
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" size="sm" disabled={candidatos.length === 0}>
            Incluir
          </Button>
        </form>
      ) : null}
      {entradas.length > 0 ? (
        <ul className="flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
          {entradas.map((entrada) => (
            <li key={`${entrada.em}-${entrada.login}-${entrada.incluido}`}>
              {dataHoraBR(entrada.em)} · {entrada.ator} {entrada.incluido ? 'incluiu' : 'removeu'}{' '}
              {entrada.login}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
