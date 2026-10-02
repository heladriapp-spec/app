import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { GATES_ESTEIRA, rotuloGate } from '@/lib/entregas/esteira'
import {
  AREA_LABEL,
  COMPLEXIDADE_LABEL,
  GATE_STATUS_LABEL,
  NIVEL_LABEL,
  RISCO_LABEL,
  ROADMAP_LABEL,
  TIMELINE_LABEL,
  TIPO_LABEL,
} from '@/lib/entregas/rotulos'
import type { EntregaEsteira, PainelEsteira, StatusGateEsteira } from '@/lib/entregas/tipos'
import { STATUS_CHECK_LABEL, STATUS_SAUDE_LABEL } from '@/lib/saude/rotulos'
import {
  ArrowRight,
  type LucideIcon,
  CalendarDays,
  CircleCheck,
  Flag,
  FlaskConical,
  GitBranch,
  HeartPulse,
  Rocket,
  ScrollText,
  Telescope,
  TriangleAlert,
  Wrench,
} from 'lucide-react'
import Link from 'next/link'

const ETAPAS = ['implantado', 'em_desenvolvimento', 'proxima', 'planejado', 'futuro'] as const
const FAIXAS = ['agora', 'proximo', 'depois', 'futuro'] as const

const ICONE_ETAPA: Record<(typeof ETAPAS)[number], LucideIcon> = {
  implantado: CircleCheck,
  em_desenvolvimento: Wrench,
  proxima: ArrowRight,
  planejado: CalendarDays,
  futuro: Telescope,
}

function Metrica({
  icone: Icone,
  rotulo,
  valor,
  detalhe,
}: {
  icone: LucideIcon
  rotulo: string
  valor: string
  detalhe?: string
}) {
  return (
    <article className="flex gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icone className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">{rotulo}</p>
        <p className="mt-1 font-semibold leading-snug">{valor}</p>
        {detalhe ? <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p> : null}
      </div>
    </article>
  )
}

function tomGate(status: StatusGateEsteira) {
  if (status === 'concluido') return 'secondary' as const
  if (status === 'em_andamento') return 'default' as const
  if (status === 'bloqueado') return 'destructive' as const
  return 'outline' as const
}

function ambienteLabel(ambiente: EntregaEsteira['ambiente']) {
  if (ambiente === 'producao') return 'Produção'
  if (ambiente === 'dev') return 'DEV'
  return 'Fila'
}

export function EsteiraPainel({ painel }: { painel: PainelEsteira }) {
  const saude = painel.saude

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GitBranch className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Esteira</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Próximo passo desta versão. Aprovar em Implantações libera desenvolver; não publica
              sozinho.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/administracao/implementacoes?visao=releases"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Rocket data-icon="inline-start" />
            Implantações
          </Link>
          <Link href="/administracao/logs" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <ScrollText data-icon="inline-start" />
            Logs
          </Link>
          <Link href="/administracao/saude" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <HeartPulse data-icon="inline-start" />
            Saúde
          </Link>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica icone={Rocket} rotulo="Produção" valor={painel.versaoProducao} />
        <Metrica
          icone={FlaskConical}
          rotulo="DEV"
          valor={`${painel.versaoDev} · ${painel.build}`}
          detalhe={painel.ambiente}
        />
        <Metrica
          icone={GitBranch}
          rotulo="Entrega atual"
          valor={painel.entregaAtual?.nome ?? 'Nenhuma'}
          detalhe={
            painel.origemAtual === 'aprovada'
              ? 'Aprovada para desenvolver'
              : painel.origemAtual === 'nesta_versao'
                ? 'Implantada em DEV'
                : '—'
          }
        />
        <Metrica
          icone={Flag}
          rotulo="Próximo gate"
          valor={painel.proximoGate ? rotuloGate(painel.proximoGate) : 'Nenhum'}
          detalhe={
            painel.proximaSugerida
              ? `Sugerida: ${painel.proximaSugerida.nome} (ainda não aprovada)`
              : 'Sugerida: —'
          }
        />
      </section>

      {saude ? (
        <Link
          href="/administracao/saude"
          className="grid gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/30 sm:grid-cols-3"
        >
          <div>
            <p className="text-xs text-muted-foreground">Saúde</p>
            <p className="font-medium">{STATUS_SAUDE_LABEL[saude.status]}</p>
            <p className="text-xs text-muted-foreground">
              {saude.erros} erro(s) · {saude.alertas} alerta(s)
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Capacidade</p>
            <p className="font-medium">{STATUS_CHECK_LABEL[saude.capacity.status as keyof typeof STATUS_CHECK_LABEL] ?? saude.capacity.status}</p>
            <p className="text-xs text-muted-foreground">{saude.capacity.mensagem}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pré-requisitos</p>
            <p className="font-medium">
              {STATUS_CHECK_LABEL[saude.prerequisites.status as keyof typeof STATUS_CHECK_LABEL] ??
                saude.prerequisites.status}
            </p>
            <p className="text-xs text-muted-foreground">{saude.prerequisites.mensagem}</p>
          </div>
        </Link>
      ) : null}

      <div className="flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
        <Flag className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Próximo passo
          </p>
          <p className="mt-1 text-sm">{painel.proximoPasso.texto}</p>
        </div>
      </div>

      {painel.entregaAtual ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold tracking-tight">Gates da entrega atual</h2>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {GATES_ESTEIRA.map((gate, index) => {
              const estado =
                painel.entregaAtual?.gates.find((item) => item.id === gate.id)?.status ?? 'pendente'
              return (
                <li key={gate.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-sm">
                  <span className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">{gate.label}</span>
                  <Badge variant={tomGate(estado)}>{GATE_STATUS_LABEL[estado]}</Badge>
                </li>
              )
            })}
          </ol>
          <article className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline">{TIPO_LABEL[painel.entregaAtual.tipo]}</Badge>
              <Badge variant="secondary">{painel.entregaAtual.statusExibicao}</Badge>
            </div>
            <h3 className="mt-2 font-medium">{painel.entregaAtual.nome}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{painel.entregaAtual.resumo}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {ambienteLabel(painel.entregaAtual.ambiente)} · complexidade{' '}
              {COMPLEXIDADE_LABEL[painel.entregaAtual.complexidade]} · risco{' '}
              {RISCO_LABEL[painel.entregaAtual.risco]} ·{' '}
              {painel.entregaAtual.areas.map((area) => AREA_LABEL[area]).join(', ')}
            </p>
          </article>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold tracking-tight">Timeline</h2>
        <div className="grid gap-4 lg:grid-cols-5">
          {ETAPAS.map((etapa) => {
            const Icone = ICONE_ETAPA[etapa]
            return (
            <div key={etapa} className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                <Icone className="size-3.5 text-primary" aria-hidden />
                {TIMELINE_LABEL[etapa]}
              </p>
              {etapa === 'futuro' ? (
                <ul className="mt-2 grid gap-2">
                  {painel.roadmap.futuro.map((item) => (
                    <li key={item.nome} className="text-sm">
                      {item.nome}
                      <span className="block text-xs text-muted-foreground">{item.versao}</span>
                    </li>
                  ))}
                </ul>
              ) : painel.timeline[etapa].length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">—</p>
              ) : (
                <ul className="mt-2 grid gap-2">
                  {painel.timeline[etapa].map((item) => (
                    <li key={item.id} className="text-sm">
                      <Link
                        href={`/administracao/implementacoes/${item.id}`}
                        className="hover:underline"
                      >
                        {item.nome}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {item.versaoEfetiva ?? item.versaoPrevista}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold tracking-tight">Roadmap</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FAIXAS.map((faixa) => (
            <div key={faixa} className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {ROADMAP_LABEL[faixa]}
              </p>
              {faixa === 'futuro' ? (
                <ul className="mt-2 grid gap-1 text-sm">
                  {painel.roadmap.futuro.map((item) => (
                    <li key={item.nome}>{item.nome}</li>
                  ))}
                </ul>
              ) : painel.roadmap[faixa].length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">—</p>
              ) : (
                <ul className="mt-2 grid gap-1 text-sm">
                  {painel.roadmap[faixa].map((item) => (
                    <li key={item.id}>
                      {item.nome}
                      <span className="block text-xs text-muted-foreground">
                        {item.versaoPrevista}
                        {faixa === 'proximo' ? ' · sugerida, não aprovada' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{painel.motivoOrdem}</p>
      </section>

      <p className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Conflitos da fila: {NIVEL_LABEL[painel.parecer.nivel]}. Alerta não bloqueia. Bloqueio
          impede aprovar.
        </span>
      </p>
    </div>
  )
}
