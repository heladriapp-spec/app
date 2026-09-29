import { Badge } from '@/components/ui/badge'
import {
  GRUPO_CHECK_LABEL,
  STATUS_CHECK_LABEL,
  STATUS_SAUDE_LABEL,
} from '@/lib/saude/rotulos'
import type { RelatorioSaude, StatusCheck } from '@/lib/saude/tipos'

function tom(status: StatusCheck) {
  if (status === 'ok') return 'secondary' as const
  if (status === 'erro') return 'destructive' as const
  if (status === 'alerta') return 'outline' as const
  return 'outline' as const
}

export function SaudePainel({
  relatorio,
  completo,
}: {
  relatorio: RelatorioSaude
  completo?: boolean
}) {
  const grupos = ['ambiente', 'produto'] as const

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Estado</p>
          <p className="font-medium">{STATUS_SAUDE_LABEL[relatorio.status]}</p>
          <p className="text-xs text-muted-foreground">
            {relatorio.contagem.ok} ok · {relatorio.contagem.alerta} alerta(s) ·{' '}
            {relatorio.contagem.erro} erro(s)
          </p>
        </article>
        <article className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Versão</p>
          <p className="font-medium">
            {relatorio.versao} · {relatorio.build}
          </p>
          <p className="text-xs text-muted-foreground">{relatorio.ambiente}</p>
        </article>
        <article className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Pré-requisitos</p>
          <p className="font-medium">{STATUS_CHECK_LABEL[relatorio.prerequisites.status]}</p>
          <p className="text-xs text-muted-foreground">{relatorio.prerequisites.mensagem}</p>
        </article>
        <article className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Capacidade</p>
          <p className="font-medium">{STATUS_CHECK_LABEL[relatorio.capacity.status]}</p>
          <p className="text-xs text-muted-foreground">{relatorio.capacity.mensagem}</p>
        </article>
      </section>

      {grupos.map((grupo) => {
        const itens = relatorio.checks.filter(
          (check) => check.grupo === grupo && (completo || check.status !== 'nao_aplicavel'),
        )
        if (itens.length === 0) return null
        return (
          <section key={grupo} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">{GRUPO_CHECK_LABEL[grupo]}</h2>
            <ul className="grid gap-2">
              {itens.map((check) => (
                <li key={check.id} className="rounded-lg border bg-card px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{check.nome}</p>
                    <Badge variant={tom(check.status)}>{STATUS_CHECK_LABEL[check.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{check.mensagem}</p>
                  {completo && check.detalhe ? (
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{check.detalhe}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <p className="text-xs text-muted-foreground">
        Leitura em {relatorio.duracaoMs} ms. Nenhum segredo entra neste relatório.
        {completo
          ? ' A sonda pública em /api/health omite o detalhe.'
          : ' O detalhe fica na saúde do administrador.'}
      </p>
    </div>
  )
}
