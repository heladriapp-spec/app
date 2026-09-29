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
import { GitBranch, HeartPulse, Rocket, ScrollText } from 'lucide-react'
import Link from 'next/link'

const ETAPAS = ['implantado', 'em_desenvolvimento', 'proxima', 'planejado', 'futuro'] as const
const FAIXAS = ['agora', 'proximo', 'depois', 'futuro'] as const

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold md:text-xl">
            <GitBranch className="size-5 text-muted-foreground" />
            Esteira
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Próximo passo desta versão. Aprovar em Implantações libera desenvolver; não publica
            sozinho.
          </p>
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

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Produção</p>
          <p className="font-medium">{painel.versaoProducao}</p>
        </article>
        <article className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">DEV</p>
          <p className="font-medium">
            {painel.versaoDev} · {painel.build}
          </p>
          <p className="text-xs text-muted-foreground">{painel.ambiente}</p>
        </article>
        <article className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Entrega atual</p>
          <p className="font-medium">{painel.entregaAtual?.nome ?? 'Nenhuma'}</p>
          <p className="text-xs text-muted-foreground">
            {painel.origemAtual === 'aprovada'
              ? 'Aprovada para desenvolver'
              : painel.origemAtual === 'nesta_versao'
                ? 'Implantada em DEV'
                : '—'}
          </p>
        </article>
        <article className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Próximo gate</p>
          <p className="font-medium">
            {painel.proximoGate ? rotuloGate(painel.proximoGate) : 'Nenhum'}
          </p>
          <p className="text-xs text-muted-foreground">
            Sugerida:{' '}
            {painel.proximaSugerida
              ? `${painel.proximaSugerida.nome} (ainda não aprovada)`
              : '—'}
          </p>
        </article>
      </section>

      {saude ? (
        <Link
          href="/administracao/saude"
          className="grid gap-2 rounded-lg border bg-card p-3 hover:bg-muted/40 sm:grid-cols-3"
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

      <div className="rounded-lg border bg-card px-3 py-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Próximo passo
        </p>
        <p className="mt-1 text-sm">{painel.proximoPasso.texto}</p>
      </div>

      {painel.entregaAtual ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Gates da entrega atual</h2>
          <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {GATES_ESTEIRA.map((gate, index) => {
              const estado =
                painel.entregaAtual?.gates.find((item) => item.id === gate.id)?.status ?? 'pendente'
              return (
                <li key={gate.id} className="flex flex-col gap-1 rounded-lg border bg-card p-3">
                  <span className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">{gate.label}</span>
                  <Badge variant={tomGate(estado)}>{GATE_STATUS_LABEL[estado]}</Badge>
                </li>
              )
            })}
          </ol>
          <article className="rounded-lg border bg-card p-4">
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

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Timeline</h2>
        <div className="grid gap-3 lg:grid-cols-5">
          {ETAPAS.map((etapa) => (
            <div key={etapa} className="rounded-lg border p-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
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
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Roadmap</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FAIXAS.map((faixa) => (
            <div key={faixa} className="rounded-lg border p-3">
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

      <p className="text-sm text-muted-foreground">
        Conflitos da fila: {NIVEL_LABEL[painel.parecer.nivel]}. Alerta não bloqueia. Bloqueio
        impede aprovar.
      </p>
    </div>
  )
}
