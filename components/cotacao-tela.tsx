'use client'

import { salvarPreenchimento } from '@/app/actions/projetos'
import { AcoesPreenchimento } from '@/components/acoes-preenchimento'
import { Recado } from '@/components/recado'
import { NotaArquivoReferencial } from '@/components/arquivo-referencial'
import { baixarPlanilha } from '@/components/baixar-planilha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CotacaoLida, FaseCronograma, ItemCotacao } from '@/lib/planilha/cotacao'
import {
  mascaraMoeda,
  mascaraPercentual,
  rascunhoExtra,
  rotuloExtra,
  valorFinalServico,
} from '@/lib/planilha/extra'
import { formatarMoedaBR, formatarNumeroBR, lerNumeroBR } from '@/lib/planilha/numeros'
import { adesaoDe, opcoesStatus, type OpcaoStatus } from '@/lib/planilha/status'
import type { ExtraServico } from '@/lib/projetos/tipos'
import { cn } from '@/lib/utils'
import {
  BookOpen,
  Calculator,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  HardHat,
  Package,
  PenLine,
  Plus,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type ValorItem = {
  valor: string
  observacao: string
  valorBase: string
  extras: ExtraServico[]
  status: string
}

type Valores = Record<string, ValorItem>

type Capitulo = {
  id: string
  nome: string
  kicker: string
  origem: 'leitura' | 'materiais' | 'mao' | 'resumo' | 'cronograma'
  grupo?: string
}

const STATUS: Record<string, string> = {
  PENDENTE: 'border-amber-300 bg-amber-50 text-amber-950',
  FECHADO: 'border-emerald-300 bg-emerald-50 text-emerald-950',
  DIVERGENTE: 'border-destructive/40 bg-destructive/10 text-destructive',
  REFORMADO: 'border-border bg-muted text-foreground',
  EXPLÍCITO: 'border-border bg-background text-foreground',
  EXPLICITO: 'border-border bg-background text-foreground',
  DERIVADO: 'border-border bg-muted text-muted-foreground',
}

export function CotacaoTela({
  projetoId,
  arquivoNome,
  cotacao,
  iniciais,
}: {
  projetoId: string
  arquivoNome: string | null
  cotacao: CotacaoLida
  iniciais: Valores
}) {
  const capitulos = montarCapitulos(cotacao)
  const [valores, setValores] = useState(iniciais)
  const [aberto, setAberto] = useState(capitulos[0]?.id ?? '')
  const [aviso, setAviso] = useState('')
  const [baixando, setBaixando] = useState(false)
  const [concluindo, setConcluindo] = useState(false)
  const router = useRouter()
  const totais = totaisDe(cotacao, valores)
  const ordem = capitulos.findIndex((item) => item.id === aberto)
  const atual = capitulos[ordem] ?? capitulos[0]
  if (!atual) return null

  function alterar(codigo: string, campo: Partial<ValorItem>) {
    setValores((prev) => ({
      ...prev,
      [codigo]: {
        valor: prev[codigo]?.valor ?? '',
        observacao: prev[codigo]?.observacao ?? '',
        valorBase: prev[codigo]?.valorBase ?? '',
        extras: prev[codigo]?.extras ?? [],
        status: prev[codigo]?.status ?? '',
        ...campo,
      },
    }))
  }

  async function aoBaixar(form: HTMLFormElement) {
    setBaixando(true)
    setAviso('')
    try {
      const erro = await baixarPlanilha(form)
      if (erro) setAviso(erro)
      else router.refresh()
    } catch {
      setAviso('Não foi possível baixar a planilha.')
    } finally {
      setBaixando(false)
    }
  }

  async function aoConcluir(form: HTMLFormElement) {
    setConcluindo(true)
    setAviso('')
    try {
      const erro = await baixarPlanilha(form, { concluir: true })
      if (erro) setAviso(erro)
      else router.refresh()
    } catch {
      setAviso('Não foi possível concluir o projeto.')
    } finally {
      setConcluindo(false)
    }
  }

  return (
    <form action={salvarPreenchimento} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={projetoId} />
      <ConclusaoProjeto cotacao={cotacao} valores={valores} />
      <NotaArquivoReferencial nome={arquivoNome} />
      <div className="grid items-start gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <nav className="flex flex-col gap-1.5 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:pr-1">
          <p className="px-2.5 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Capítulos
          </p>
          <p className="px-2.5 pb-2 text-[0.7rem] leading-snug text-muted-foreground">
            Verde, capítulo preenchido. Laranja, ainda falta valor. O percentual é a parte aderente.
          </p>
          {capitulos.map((item, indice) => {
            const estado = capituloPreenchido(item, cotacao, valores)
            const anterior = indice > 0 ? capitulos[indice - 1] : null
            const quebra = anterior == null || anterior.kicker !== item.kicker
            return (
              <div key={item.id} className="contents">
                {quebra ? <RotuloCapitulo nome={item.kicker} /> : null}
                <button
                  type="button"
                  onClick={() => setAberto(item.id)}
                  className={classeCapitulo(estado, item.id === atual.id)}
                  aria-current={item.id === atual.id ? 'page' : undefined}
                >
                  <span className="w-5 shrink-0 text-xs tabular-nums opacity-70">{indice + 1}</span>
                  {estado === true ? (
                    <Check className="size-3.5 shrink-0" aria-hidden />
                  ) : estado === false ? (
                    <Circle className="size-3.5 shrink-0" aria-hidden />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.nome}</span>
                    <DicaCapitulo capitulo={item} cotacao={cotacao} valores={valores} />
                  </span>
                </button>
              </div>
            )
          })}
        </nav>
        {capitulos.map((item) => {
          const indice = capitulos.findIndex((capitulo) => capitulo.id === item.id)
          const anterior = indice > 0 ? capitulos[indice - 1] : null
          const proximo = indice < capitulos.length - 1 ? capitulos[indice + 1] : null
          const itens =
            item.origem === 'materiais'
              ? cotacao.materiais.filter((linha) => linha.grupo === item.grupo)
              : item.origem === 'mao'
                ? cotacao.maoDeObra.filter((linha) => linha.grupo === item.grupo)
                : []
          const subtotal = itens.reduce((acc, linha) => acc + (totais.get(linha.codigo) ?? 0), 0)
          return (
            <section
              key={item.id}
              className={cn('@container min-w-0 flex-col gap-6', item.id === atual.id ? 'flex' : 'hidden')}
            >
              <div>
                <p className="text-xs text-muted-foreground">
                  {item.kicker} · {indice + 1} de {capitulos.length}
                </p>
                <h2 className="text-xl font-semibold tracking-tight">{item.nome}</h2>
                {itens.length > 0 ? (
                  <>
                    <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                      {itens.length} {itens.length === 1 ? 'item' : 'itens'} · {formatarMoedaBR(subtotal)}
                    </p>
                    <BarraConclusao
                      nome={item.nome}
                      className="mt-3"
                      statuses={itens.map((linha) => valores[linha.codigo]?.status || linha.status)}
                    />
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">{resumoCapitulo(item)}</p>
                )}
              </div>
              {item.origem === 'leitura' ? <Instrucoes cotacao={cotacao} /> : null}
              {item.origem === 'materiais' || item.origem === 'mao' ? (
                <>
                  <LegendaPreenchimento />
                  <ListaItens
                    itens={itens}
                    origem={item.origem}
                    legenda={cotacao.legenda}
                    valores={valores}
                    totais={totais}
                    onAlterar={alterar}
                  />
                </>
              ) : null}
              {item.origem === 'resumo' ? (
                <Resumo cotacao={cotacao} iniciais={valores} totais={totais} />
              ) : null}
              {item.origem === 'cronograma' ? <Cronograma cotacao={cotacao} /> : null}
              {aviso ? <Recado tom="erro">{aviso}</Recado> : null}
              <div className="sticky bottom-0 z-10 -mx-5 mt-2 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-5 py-4 backdrop-blur md:mx-0 md:rounded-xl md:border md:px-4 md:shadow-sm">
                {anterior ? (
                  <Button type="button" variant="outline" onClick={() => setAberto(anterior.id)}>
                    <ChevronLeft data-icon="inline-start" />
                    {anterior.nome}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Cada capítulo é uma seção da planilha.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <AcoesPreenchimento
                    ocupado={baixando || concluindo}
                    baixando={baixando}
                    concluindo={concluindo}
                    onBaixar={(form) => void aoBaixar(form)}
                    onConcluir={(form) => void aoConcluir(form)}
                  />
                  {proximo ? (
                    <Button type="button" onClick={() => setAberto(proximo.id)}>
                      {proximo.nome}
                      <ChevronRight data-icon="inline-end" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </form>
  )
}

const ICONE_KICKER: Record<string, LucideIcon> = {
  Leitura: BookOpen,
  Materiais: Package,
  Serviços: HardHat,
  Calculado: Calculator,
  Cronograma: CalendarDays,
}

function RotuloCapitulo({ nome }: { nome: string }) {
  const Icone = ICONE_KICKER[nome] ?? BookOpen
  return (
    <p className="mt-4 flex items-center gap-2 px-2.5 pt-1 pb-1 text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase first:mt-0">
      <Icone className="size-3.5 text-primary" aria-hidden />
      {nome}
    </p>
  )
}

function classeCapitulo(preenchido: boolean | null, ativo: boolean) {
  return cn(
    'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
    preenchido === true && 'border-emerald-400 bg-emerald-50 text-emerald-950',
    preenchido === false && 'border-amber-400 bg-amber-50 text-amber-950',
    preenchido === null && 'border-border bg-background',
    ativo && 'ring-2 ring-primary/40',
  )
}

function montarCapitulos(cotacao: CotacaoLida): Capitulo[] {
  const lista: Capitulo[] = []
  if (cotacao.orientacoes.length > 0 || cotacao.legenda.length > 0 || cotacao.preenchimento) {
    lista.push({ id: 'instrucoes', nome: 'Instruções', kicker: 'Leitura', origem: 'leitura' })
  }
  gruposDe(cotacao.materiais).forEach((grupo, indice) => {
    lista.push({ id: `mat-${indice}`, nome: grupo, kicker: 'Materiais', origem: 'materiais', grupo })
  })
  gruposDe(cotacao.maoDeObra).forEach((grupo, indice) => {
    lista.push({ id: `srv-${indice}`, nome: grupo, kicker: 'Serviços', origem: 'mao', grupo })
  })
  lista.push({ id: 'resumo', nome: 'Resumo', kicker: 'Calculado', origem: 'resumo' })
  if (cotacao.fases.length > 0) {
    lista.push({ id: 'cronograma', nome: 'Cronograma', kicker: 'Cronograma', origem: 'cronograma' })
  }
  return lista
}

function capituloPreenchido(capitulo: Capitulo, cotacao: CotacaoLida, valores: Valores) {
  if (capitulo.origem !== 'materiais' && capitulo.origem !== 'mao') return null
  const fonte = capitulo.origem === 'materiais' ? cotacao.materiais : cotacao.maoDeObra
  const itens = fonte.filter((item) => item.grupo === capitulo.grupo)
  if (itens.length === 0) return null
  return itens.every((item) => (valores[item.codigo]?.valor ?? '').trim().length > 0)
}

function itensDoCapitulo(capitulo: Capitulo, cotacao: CotacaoLida) {
  if (capitulo.origem !== 'materiais' && capitulo.origem !== 'mao') return []
  const fonte = capitulo.origem === 'materiais' ? cotacao.materiais : cotacao.maoDeObra
  return fonte.filter((item) => item.grupo === capitulo.grupo)
}

function DicaCapitulo({
  capitulo,
  cotacao,
  valores,
}: {
  capitulo: Capitulo
  cotacao: CotacaoLida
  valores: Valores
}) {
  if (capitulo.origem !== 'materiais' && capitulo.origem !== 'mao') {
    const dica =
      capitulo.id === 'instrucoes'
        ? 'Como preencher'
        : capitulo.id === 'resumo'
          ? 'Totais do trabalho'
          : capitulo.id === 'cronograma'
            ? 'Fases e datas'
            : capitulo.kicker
    return <span className="block truncate text-[0.7rem] opacity-70">{dica}</span>
  }
  const itens = itensDoCapitulo(capitulo, cotacao)
  const adesao = adesaoDe(itens.map((item) => valores[item.codigo]?.status || item.status))
  return (
    <span className="mt-0.5 flex items-center gap-2 text-[0.7rem] opacity-80">
      <span className="truncate">
        {itens.length} {itens.length === 1 ? 'item' : 'itens'}
      </span>
      {adesao ? (
        <>
          <span className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-current/25" aria-hidden>
            <span className="block h-full bg-current" style={{ width: `${adesao.percentual}%` }} />
          </span>
          <span className="shrink-0 tabular-nums" title="Parte aderente: sem pendente e sem divergente">
            {adesao.percentual}%
          </span>
        </>
      ) : null}
    </span>
  )
}

function statusesDoProjeto(cotacao: CotacaoLida, valores: Valores) {
  return [...cotacao.materiais, ...cotacao.maoDeObra].map(
    (item) => valores[item.codigo]?.status || item.status,
  )
}

function ConclusaoProjeto({ cotacao, valores }: { cotacao: CotacaoLida; valores: Valores }) {
  const [alvo, setAlvo] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setAlvo(document.getElementById('conclusao-projeto'))
  }, [])
  if (!alvo) return null
  return createPortal(
    <BarraConclusao
      nome="o projeto"
      rotulo="Projeto"
      statuses={statusesDoProjeto(cotacao, valores)}
    />,
    alvo,
  )
}

function BarraConclusao({
  nome,
  statuses,
  rotulo = 'Conclusão',
  className,
}: {
  nome: string
  statuses: string[]
  rotulo?: string
  className?: string
}) {
  const adesao = adesaoDe(statuses)
  if (!adesao) return null
  return (
    <div className={cn('max-w-sm', className)}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{rotulo}</span>
        <span className="font-medium tabular-nums">{adesao.percentual}%</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={adesao.percentual}
        aria-label={`${adesao.aderentes} de ${adesao.total} itens aderentes em ${nome}`}
      >
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${adesao.percentual}%` }} />
      </div>
      <p className="mt-1 text-[0.7rem] text-muted-foreground">
        {`${adesao.aderentes} de ${adesao.total} ${adesao.total === 1 ? 'aderente' : 'aderentes'}. Pendente e divergente ficam de fora.`}
      </p>
    </div>
  )
}

function resumoCapitulo(capitulo: Capitulo) {
  if (capitulo.origem === 'leitura' && capitulo.id === 'instrucoes') {
    return 'O que a planilha explica antes de pedir valor.'
  }
  if (capitulo.origem === 'resumo') return 'Totais calculados a partir do que foi preenchido.'
  if (capitulo.origem === 'cronograma') return 'Fases, datas e equipe. Esta parte é leitura.'
  return ''
}

function Instrucoes({ cotacao }: { cotacao: CotacaoLida }) {
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {cotacao.titulo ? <p className="text-sm font-medium">{cotacao.titulo}</p> : null}
      {cotacao.subtitulo ? <p className="text-sm text-muted-foreground">{cotacao.subtitulo}</p> : null}
      {cotacao.preenchimento ? (
        <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          {cotacao.preenchimento}
        </p>
      ) : null}
      {cotacao.orientacoes.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {cotacao.orientacoes.map((texto, indice) => (
            <li key={texto} className="flex gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {indice + 1}
              </span>
              <span>{texto}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {cotacao.legenda.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Status do levantamento</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {cotacao.legenda.map((item) => (
              <li key={item.status} className="rounded-xl border bg-card px-4 py-3 shadow-sm">
                <StatusBadge status={item.status} />
                <p className="mt-1.5 text-sm text-muted-foreground">{item.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function LegendaPreenchimento() {
  return (
    <p className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm">
      <span className="inline-flex items-center gap-2">
        <PenLine className="size-3.5 text-primary" aria-hidden />
        Campo para preencher
      </span>
      <span className="inline-flex items-center gap-2">
        <Calculator className="size-3.5 text-muted-foreground" aria-hidden />
        Total calculado, não se digita
      </span>
    </p>
  )
}

function ListaItens({
  itens,
  origem,
  legenda,
  valores,
  totais,
  onAlterar,
}: {
  itens: ItemCotacao[]
  origem: 'materiais' | 'mao'
  legenda: CotacaoLida['legenda']
  valores: Valores
  totais: Map<string, number | null>
  onAlterar: (codigo: string, campo: Partial<ValorItem>) => void
}) {
  const opcoes = opcoesStatus(legenda)
  return (
    <div className="grid gap-6 @5xl:grid-cols-2">
      {itens.map((item) => (
        <ItemCard
          key={item.codigo}
          item={item}
          origem={origem}
          valor={valores[item.codigo]?.valor ?? ''}
          valorBase={valores[item.codigo]?.valorBase ?? ''}
          extras={valores[item.codigo]?.extras ?? []}
          observacao={valores[item.codigo]?.observacao ?? ''}
          status={valores[item.codigo]?.status || item.status}
          opcoes={opcoes}
          total={totais.get(item.codigo) ?? null}
          onAlterar={onAlterar}
        />
      ))}
    </div>
  )
}

function ItemCard({
  item,
  origem,
  valor,
  valorBase,
  extras,
  observacao,
  status,
  opcoes,
  total,
  onAlterar,
}: {
  item: ItemCotacao
  origem: 'materiais' | 'mao'
  valor: string
  valorBase: string
  extras: ExtraServico[]
  observacao: string
  status: string
  opcoes: OpcaoStatus[]
  total: number | null
  onAlterar: (codigo: string, campo: Partial<ValorItem>) => void
}) {
  const valorId = `valor-${item.codigo}`
  const obsId = `obs-${item.codigo}`
  const servico = origem === 'mao'
  const [painel, setPainel] = useState(false)
  const [reais, setReais] = useState('')
  const [percentual, setPercentual] = useState('')
  const baseTexto = extras.length > 0 ? valorBase : valor.trim()
  const base = lerNumeroBR(baseTexto)
  const painelId = `extra-${item.codigo}`

  function fecharPainel() {
    setPainel(false)
    setReais('')
    setPercentual('')
  }

  function aplicar() {
    if (base == null) return
    const extra = rascunhoExtra(crypto.randomUUID(), reais, percentual)
    if (!extra) return
    const lista = [...extras, extra]
    onAlterar(item.codigo, {
      valorBase: baseTexto,
      extras: lista,
      valor: formatarNumeroBR(valorFinalServico(base, lista)),
    })
    fecharPainel()
  }

  function remover(id: string) {
    const lista = extras.filter((extra) => extra.id !== id)
    const baseNumero = lerNumeroBR(valorBase)
    if (lista.length === 0) {
      onAlterar(item.codigo, { extras: [], valorBase: '', valor: valorBase || valor })
      return
    }
    if (baseNumero == null) {
      onAlterar(item.codigo, { extras: lista })
      return
    }
    onAlterar(item.codigo, {
      extras: lista,
      valor: formatarNumeroBR(valorFinalServico(baseNumero, lista)),
    })
  }

  return (
    <article
      id={`item-${item.codigo}`}
      data-origem={origem}
      className="@container flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm"
    >
      <div
        className={cn(
          'flex min-w-0 flex-col gap-3',
          painel && '@min-[32rem]:flex-row @min-[32rem]:items-start',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-primary">{item.codigo}</p>
              <h4 className="font-medium leading-snug">{item.titulo}</h4>
            </div>
            <SeletorStatus
              codigo={item.codigo}
              status={status}
              opcoes={opcoes}
              onEscolher={(proximo) => onAlterar(item.codigo, { status: proximo })}
            />
          </header>
          {item.detalhe ? <p className="text-sm leading-relaxed text-muted-foreground">{item.detalhe}</p> : null}
          {item.local ? (
            <p className="text-sm leading-relaxed">
              <span className="text-muted-foreground">Onde entra: </span>
              {item.local}
            </p>
          ) : null}
          <p className="text-sm">
            <span className="text-muted-foreground">Quantidade: </span>
            <span className="font-medium tabular-nums">
              {item.quantidade || '—'}
              {item.unidade ? ` ${item.unidade}` : ''}
            </span>
          </p>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9.5rem] sm:items-end">
            <div className="grid gap-1">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={valorId} className="text-sm font-medium">
                  {item.rotuloValor}
                </label>
                {servico ? (
                  <span className="inline-flex items-center gap-1.5">
                    {extras.length > 0 ? (
                      <span
                        className="size-1.5 rounded-full bg-amber-500"
                        title="Extra aplicado"
                        aria-label="Extra aplicado"
                      />
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      aria-expanded={painel}
                      aria-controls={painelId}
                      aria-label="Extra"
                      title="Extra"
                      onClick={() => (painel ? fecharPainel() : setPainel(true))}
                    >
                      <Plus />
                    </Button>
                  </span>
                ) : null}
              </div>
              <Input
                id={valorId}
                name={`valor:${item.codigo}`}
                value={valor}
                onChange={(evento) => onAlterar(item.codigo, { valor: evento.target.value })}
                readOnly={extras.length > 0}
                inputMode="decimal"
                autoComplete="off"
                aria-label={`${item.rotuloValor} de ${item.codigo}`}
                placeholder="0,00"
                className="border-primary/25 bg-primary/5 text-right read-only:bg-muted/60 focus-visible:border-primary focus-visible:ring-primary/20"
              />
              <p className="text-xs text-muted-foreground">
                {extras.length > 0
                  ? 'Este valor inclui extra. Remova os extras para voltar ao valor base.'
                  : item.unidade
                    ? `Preço por ${item.unidade}.`
                    : 'Preço da unidade desta linha.'}
              </p>
            </div>
            <div className="rounded-xl bg-muted px-3 py-2.5 text-right">
              <p className="text-[0.7rem] text-muted-foreground">Total da linha</p>
              <p className="font-medium tabular-nums" data-total>
                {total == null ? '—' : formatarMoedaBR(total)}
              </p>
            </div>
          </div>
          {servico && extras.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {extras.map((extra) => {
                const rotulo = rotuloExtra(extra)
                return (
                  <li
                    key={extra.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted/70 px-2 py-1 text-xs"
                  >
                    <span className="tabular-nums">Extra: + {rotulo}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remover extra ${rotulo}`}
                      onClick={() => remover(extra.id)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                )
              })}
            </ul>
          ) : null}
          <input type="hidden" name={`status:${item.codigo}`} value={status} />
          {servico ? (
            <>
              <input type="hidden" name={`base:${item.codigo}`} value={valorBase} />
              <input
                type="hidden"
                name={`extras:${item.codigo}`}
                value={extras.length > 0 ? JSON.stringify(extras) : ''}
              />
            </>
          ) : null}
          {item.temObservacao ? (
            <div className="grid gap-1">
              <label htmlFor={obsId} className="text-sm font-medium">
                Observações do fornecedor
              </label>
              <textarea
                id={obsId}
                name={`obs:${item.codigo}`}
                value={observacao}
                onChange={(evento) => onAlterar(item.codigo, { observacao: evento.target.value })}
                rows={3}
                maxLength={2000}
                aria-label={`Observações de ${item.codigo}`}
                placeholder="Marca oferecida, prazo de entrega ou ressalva técnica"
                className="min-h-24 w-full rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20"
              />
            </div>
          ) : null}
        </div>
        {painel ? (
          <PainelExtra
            id={painelId}
            base={base}
            extras={extras}
            reais={reais}
            percentual={percentual}
            onReais={setReais}
            onPercentual={setPercentual}
            onAplicar={aplicar}
            onCancelar={fecharPainel}
          />
        ) : null}
      </div>
    </article>
  )
}

function PainelExtra({
  id,
  base,
  extras,
  reais,
  percentual,
  onReais,
  onPercentual,
  onAplicar,
  onCancelar,
}: {
  id: string
  base: number | null
  extras: ExtraServico[]
  reais: string
  percentual: string
  onReais: (valor: string) => void
  onPercentual: (valor: string) => void
  onAplicar: () => void
  onCancelar: () => void
}) {
  const rascunho = rascunhoExtra('previa', reais, percentual)
  const previa =
    base == null ? null : valorFinalServico(base, rascunho ? [...extras, rascunho] : extras)
  const reaisId = `${id}-reais`
  const percentualId = `${id}-percentual`
  return (
    <aside
      id={id}
      className="w-full shrink-0 rounded-lg border border-dashed border-amber-400 bg-amber-50/70 p-3 @min-[32rem]:w-60"
    >
      <p className="text-xs font-medium text-amber-950">Extra</p>
      <p className="mt-2 text-[0.7rem] text-muted-foreground">Valor base</p>
      <p className="text-sm font-medium tabular-nums">{base == null ? '—' : formatarMoedaBR(base)}</p>
      <div className="mt-3 grid gap-1">
        <label htmlFor={reaisId} className="text-xs font-medium">
          Extra em R$
        </label>
        <Input
          id={reaisId}
          value={reais}
          onChange={(evento) => onReais(mascaraMoeda(evento.target.value))}
          inputMode="numeric"
          autoComplete="off"
          placeholder="R$ 0,00"
          aria-label="Extra em reais"
          className="text-right"
        />
      </div>
      <div className="mt-2 grid gap-1">
        <label htmlFor={percentualId} className="text-xs font-medium">
          Extra em %
        </label>
        <Input
          id={percentualId}
          value={percentual}
          onChange={(evento) => onPercentual(mascaraPercentual(evento.target.value))}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0,00%"
          aria-label="Extra em percentual"
          className="text-right"
        />
      </div>
      <p className="mt-3 text-[0.7rem] text-muted-foreground">Prévia</p>
      <p className="text-sm font-medium tabular-nums" data-previa>
        {previa == null ? '—' : formatarMoedaBR(previa)}
      </p>
      {base == null ? (
        <p className="mt-2 text-xs text-muted-foreground">Preencha o valor do serviço antes de aplicar.</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={onAplicar} disabled={base == null || rascunho == null}>
          Aplicar
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </aside>
  )
}

function Resumo({
  cotacao,
  iniciais,
  totais,
}: {
  cotacao: CotacaoLida
  iniciais: Valores
  totais: Map<string, number | null>
}) {
  const grupos = gruposDe(cotacao.materiais)
  const linhas = grupos.map((grupo) => {
    const itens = cotacao.materiais.filter((item) => item.grupo === grupo)
    const total = itens.reduce((acc, item) => acc + (totais.get(item.codigo) ?? 0), 0)
    return { grupo, quantidade: itens.length, total }
  })
  const materiais = linhas.reduce((acc, linha) => acc + linha.total, 0)
  const mao = cotacao.maoDeObra.reduce((acc, item) => acc + (totais.get(item.codigo) ?? 0), 0)
  const geral = materiais + mao
  const contagem = contarStatus([...cotacao.materiais, ...cotacao.maoDeObra], iniciais)
  const semValor = [...cotacao.materiais, ...cotacao.maoDeObra].filter(
    (item) => !(iniciais[item.codigo]?.valor ?? '').trim(),
  ).length

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="rounded-xl border px-4 py-3">
        <p className="text-xs text-muted-foreground">Total geral cotado</p>
        <p className="text-2xl font-semibold tabular-nums" data-resumo="geral">
          {formatarMoedaBR(geral)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Materiais <span data-resumo="materiais">{formatarMoedaBR(materiais)}</span> · mão de obra,
          serviços e logística <span data-resumo="mao">{formatarMoedaBR(mao)}</span>
        </p>
        {semValor > 0 ? (
          <p className="mt-2 text-sm text-amber-800">
            {semValor} {semValor === 1 ? 'item ainda está' : 'itens ainda estão'} sem valor unitário.
          </p>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Disciplina</th>
              <th className="px-3 py-2 font-medium">Itens</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="px-3 py-2 text-right font-medium">% dos materiais</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.grupo} className="border-t">
                <td className="px-3 py-2">{linha.grupo}</td>
                <td className="px-3 py-2 tabular-nums">{linha.quantidade}</td>
                <td className="px-3 py-2 text-right tabular-nums" data-resumo={linha.grupo}>
                  {formatarMoedaBR(linha.total)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums" data-percent={linha.grupo}>
                  {materiais > 0 ? `${((linha.total / materiais) * 100).toFixed(1).replace('.', ',')}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-medium">
              <td className="px-3 py-2">Materiais</td>
              <td className="px-3 py-2 tabular-nums">{cotacao.materiais.length}</td>
              <td className="px-3 py-2 text-right tabular-nums" data-resumo="materiais-tabela">
                {formatarMoedaBR(materiais)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">100%</td>
            </tr>
            <tr className="border-t">
              <td className="px-3 py-2">Mão de obra, serviços e logística</td>
              <td className="px-3 py-2 tabular-nums">{cotacao.maoDeObra.length}</td>
              <td className="px-3 py-2 text-right tabular-nums" data-resumo="mao-tabela">
                {formatarMoedaBR(mao)}
              </td>
              <td className="px-3 py-2" />
            </tr>
            <tr className="border-t font-medium">
              <td className="px-3 py-2" colSpan={2}>
                Total geral
              </td>
              <td className="px-3 py-2 text-right tabular-nums" data-resumo="geral-tabela">
                {formatarMoedaBR(geral)}
              </td>
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
      {contagem.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {contagem.map((item) => (
            <span key={item.status} className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge status={item.status} />
              {item.quantidade}
            </span>
          ))}
        </div>
      ) : null}
      {cotacao.notaPendencias ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {cotacao.notaPendencias}
        </p>
      ) : null}
    </div>
  )
}

function Cronograma({ cotacao }: { cotacao: CotacaoLida }) {
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {cotacao.cronogramaTitulo ? <p className="text-sm font-medium">{cotacao.cronogramaTitulo}</p> : null}
      {cotacao.cronogramaIntro ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{cotacao.cronogramaIntro}</p>
      ) : null}
      <ol className="flex flex-col gap-3">
        {cotacao.fases.map((fase) => (
          <li key={fase.codigo}>
            <Fase fase={fase} />
          </li>
        ))}
      </ol>
      {cotacao.premissas.map((texto) => (
        <p key={texto} className="text-sm leading-relaxed text-muted-foreground">
          {texto}
        </p>
      ))}
    </div>
  )
}

function Fase({ fase }: { fase: FaseCronograma }) {
  const periodo =
    fase.inicio && fase.fim && fase.inicio !== fase.fim
      ? `${fase.inicio} – ${fase.fim}`
      : fase.inicio || fase.fim
  return (
    <article className="rounded-xl border px-3 py-2.5">
      <p className="text-xs text-muted-foreground">
        {fase.codigo}
        {periodo ? ` · ${periodo}` : ''}
        {fase.duracao ? ` · ${fase.duracao}` : ''}
      </p>
      <h3 className="mt-0.5 font-medium">{fase.fase}</h3>
      {fase.objetivo ? <p className="mt-1 text-sm leading-relaxed">{fase.objetivo}</p> : null}
      {fase.equipe ? <p className="mt-1 text-sm text-muted-foreground">{fase.equipe}</p> : null}
    </article>
  )
}

function SeletorStatus({
  codigo,
  status,
  opcoes,
  onEscolher,
}: {
  codigo: string
  status: string
  opcoes: OpcaoStatus[]
  onEscolher: (status: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  const atual = opcoes.find((item) => item.status === status)
  const listaId = `status-lista-${codigo}`

  useEffect(() => {
    if (!aberto) return
    function fora(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false)
    }
    function tecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto])

  return (
    <div ref={caixa} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-label={`Classificar ${codigo}. Status atual: ${status || 'nenhum'}`}
        title={atual?.texto}
        onClick={() => setAberto((valor) => !valor)}
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <StatusBadge status={status || 'Status'} />
      </button>
      {aberto ? (
        <ul
          id={listaId}
          role="listbox"
          aria-label={`Status de ${codigo}`}
          className="absolute right-0 z-30 mt-1 w-72 max-w-[min(18rem,calc(100vw-2rem))] rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {opcoes.map((opcao) => {
            const selecionado = opcao.status === status
            return (
              <li key={opcao.status}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selecionado}
                  onClick={() => {
                    onEscolher(opcao.status)
                    setAberto(false)
                  }}
                  className={cn(
                    'flex w-full flex-col items-start gap-1 rounded-lg px-2 py-1.5 text-left hover:bg-muted',
                    selecionado && 'bg-muted',
                  )}
                >
                  <StatusBadge status={opcao.status} />
                  <span className="text-xs leading-snug text-muted-foreground">{opcao.texto}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function StatusBadge({ status, titulo }: { status: string; titulo?: string }) {
  return (
    <span
      title={titulo || undefined}
      className={cn(
        'inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-medium tracking-wide',
        STATUS[status] ?? 'border-border bg-background text-foreground',
      )}
    >
      {status}
    </span>
  )
}

function gruposDe(itens: ItemCotacao[]) {
  const grupos: string[] = []
  for (const item of itens) {
    if (!grupos.includes(item.grupo)) grupos.push(item.grupo)
  }
  return grupos
}

function totaisDe(cotacao: CotacaoLida, iniciais: Valores) {
  const porItem = new Map<string, number | null>()
  for (const item of [...cotacao.materiais, ...cotacao.maoDeObra]) {
    porItem.set(item.codigo, totalDoItem(item.quantidade, iniciais[item.codigo]?.valor ?? ''))
  }
  return porItem
}

function totalDoItem(quantidade: string, valor: string) {
  const qtde = lerNumeroBR(quantidade)
  const unitario = lerNumeroBR(valor)
  if (qtde == null || unitario == null) return null
  return Math.round((qtde * unitario + Number.EPSILON) * 100) / 100
}

function contarStatus(itens: ItemCotacao[], valores: Valores) {
  const mapa = new Map<string, number>()
  for (const item of itens) {
    const status = valores[item.codigo]?.status || item.status
    if (!status) continue
    mapa.set(status, (mapa.get(status) ?? 0) + 1)
  }
  return [...mapa.entries()].map(([status, quantidade]) => ({ status, quantidade }))
}
