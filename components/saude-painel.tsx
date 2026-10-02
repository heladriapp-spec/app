import { Badge } from '@/components/ui/badge'
import { Activity, Boxes, Gauge, HeartPulse, type LucideIcon } from 'lucide-react'
import {
  GRUPO_CHECK_LABEL,
  STATUS_CHECK_LABEL,
  STATUS_SAUDE_LABEL,
} from '@/lib/saude/rotulos'
import type { RelatorioSaude, StatusCheck } from '@/lib/saude/tipos'

function Metrica({
  icone: Icone,
  rotulo,
  valor,
  detalhe,
}: {
  icone: LucideIcon
  rotulo: string
  valor: string
  detalhe: string
}) {
  return (
    <article className="flex gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icone className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">{rotulo}</p>
        <p className="mt-1 font-semibold leading-snug">{valor}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>
      </div>
    </article>
  )
}

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
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica
          icone={HeartPulse}
          rotulo="Estado"
          valor={STATUS_SAUDE_LABEL[relatorio.status]}
          detalhe={`${relatorio.contagem.ok} ok · ${relatorio.contagem.alerta} alerta(s) · ${relatorio.contagem.erro} erro(s)`}
        />
        <Metrica
          icone={Boxes}
          rotulo="Versão"
          valor={`${relatorio.versao} · ${relatorio.build}`}
          detalhe={relatorio.ambiente}
        />
        <Metrica
          icone={Activity}
          rotulo="Pré-requisitos"
          valor={STATUS_CHECK_LABEL[relatorio.prerequisites.status]}
          detalhe={relatorio.prerequisites.mensagem}
        />
        <Metrica
          icone={Gauge}
          rotulo="Capacidade"
          valor={STATUS_CHECK_LABEL[relatorio.capacity.status]}
          detalhe={relatorio.capacity.mensagem}
        />
      </section>

      {grupos.map((grupo) => {
        const itens = relatorio.checks.filter(
          (check) => check.grupo === grupo && (completo || check.status !== 'nao_aplicavel'),
        )
        if (itens.length === 0) return null
        return (
          <section key={grupo} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold tracking-tight">{GRUPO_CHECK_LABEL[grupo]}</h2>
            <ul className="grid gap-3">
              {itens.map((check) => (
                <li key={check.id} className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
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
