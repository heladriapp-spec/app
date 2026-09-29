import { salvarPreenchimento } from '@/app/actions/projetos'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CotacaoLida, FaseCronograma, ItemCotacao } from '@/lib/planilha/cotacao'
import { formatarMoedaBR, lerNumeroBR } from '@/lib/planilha/numeros'
import { cn } from '@/lib/utils'
import {
  BookOpen,
  CalendarRange,
  ChartPie,
  ChevronLeft,
  ChevronRight,
  HardHat,
  Package,
  type LucideIcon,
} from 'lucide-react'

type Valores = Record<string, { valor: string; observacao: string }>
type PassoId = 'instrucoes' | 'materiais' | 'mao' | 'resumo' | 'cronograma'

type Passo = {
  id: PassoId
  nome: string
  dica: string
  resumo: string
  Icon: LucideIcon
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
  cotacao,
  iniciais,
}: {
  projetoId: string
  cotacao: CotacaoLida
  iniciais: Valores
}) {
  const passos = montarPassos(cotacao, iniciais)
  const totais = totaisDe(cotacao, iniciais)

  if (passos.length === 0) return null

  return (
    <form action={salvarPreenchimento} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={projetoId} />
      <div className="relative grid items-start gap-2 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-x-6">
        {passos.map((item, ordem) => (
          <input
            key={item.id}
            id={`etapa-${item.id}`}
            type="radio"
            name="etapa-vista"
            defaultChecked={ordem === 0}
            className={cn('sr-only', classeRadio(item.id))}
          />
        ))}
        {passos.map((item, ordem) => {
          const Icon = item.Icon
          return (
            <label
              key={item.id}
              htmlFor={`etapa-${item.id}`}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-xl border bg-background px-2.5 py-2 lg:col-start-1',
                classeLabel(item.id),
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-current/10">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.65rem] tracking-wide uppercase opacity-70">
                  {ordem + 1} de {passos.length}
                </span>
                <span className="block truncate text-sm font-medium">{item.nome}</span>
                <span className="block truncate text-[0.7rem] opacity-70">{item.dica}</span>
              </span>
            </label>
          )
        })}
        {passos.map((item, ordem) => {
          const anterior = ordem > 0 ? passos[ordem - 1] : null
          const proximo = ordem < passos.length - 1 ? passos[ordem + 1] : null
          return (
            <section
              key={item.id}
              className={cn(
                'hidden min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:row-span-6',
                classePainel(item.id),
              )}
            >
              <div>
                <p className="text-xs text-muted-foreground">
                  Etapa {ordem + 1} de {passos.length}
                </p>
                <h2 className="text-lg font-semibold">{item.nome}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{item.resumo}</p>
              </div>
              {item.id === 'instrucoes' ? <Instrucoes cotacao={cotacao} /> : null}
              {item.id === 'materiais' ? (
                <>
                  <LegendaPreenchimento />
                  <ListaItens
                    itens={cotacao.materiais}
                    origem="materiais"
                    legenda={cotacao.legenda}
                    iniciais={iniciais}
                    totais={totais}
                  />
                </>
              ) : null}
              {item.id === 'mao' ? (
                <>
                  <LegendaPreenchimento />
                  <ListaItens
                    itens={cotacao.maoDeObra}
                    origem="mao"
                    legenda={cotacao.legenda}
                    iniciais={iniciais}
                    totais={totais}
                  />
                </>
              ) : null}
              {item.id === 'resumo' ? (
                <Resumo cotacao={cotacao} iniciais={iniciais} totais={totais} />
              ) : null}
              {item.id === 'cronograma' ? <Cronograma cotacao={cotacao} /> : null}
              <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex flex-wrap items-center justify-between gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:px-0">
                {anterior ? (
                  <label htmlFor={`etapa-${anterior.id}`} className={cn(buttonVariants({ variant: 'outline' }), 'cursor-pointer')}>
                    <ChevronLeft data-icon="inline-start" />
                    {anterior.nome}
                  </label>
                ) : (
                  <p className="text-xs text-muted-foreground">Comece pela leitura. O preenchimento vem em seguida.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant={proximo ? 'outline' : 'default'}>
                    Salvar preenchimento
                  </Button>
                  {proximo ? (
                    <label htmlFor={`etapa-${proximo.id}`} className={cn(buttonVariants(), 'cursor-pointer')}>
                      <proximo.Icon data-icon="inline-start" />
                      {proximo.nome}
                      <ChevronRight data-icon="inline-end" />
                    </label>
                  ) : null}
                </div>
              </div>
            </section>
          )
        })}
      </div>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_TOTAIS }} />
    </form>
  )
}

function classeRadio(id: PassoId) {
  if (id === 'instrucoes') return 'peer/instrucoes'
  if (id === 'materiais') return 'peer/materiais'
  if (id === 'mao') return 'peer/mao'
  if (id === 'resumo') return 'peer/resumo'
  return 'peer/cronograma'
}

function classeLabel(id: PassoId) {
  if (id === 'instrucoes') {
    return 'peer-checked/instrucoes:border-foreground peer-checked/instrucoes:bg-foreground peer-checked/instrucoes:text-background'
  }
  if (id === 'materiais') {
    return 'peer-checked/materiais:border-foreground peer-checked/materiais:bg-foreground peer-checked/materiais:text-background'
  }
  if (id === 'mao') {
    return 'peer-checked/mao:border-foreground peer-checked/mao:bg-foreground peer-checked/mao:text-background'
  }
  if (id === 'resumo') {
    return 'peer-checked/resumo:border-foreground peer-checked/resumo:bg-foreground peer-checked/resumo:text-background'
  }
  return 'peer-checked/cronograma:border-foreground peer-checked/cronograma:bg-foreground peer-checked/cronograma:text-background'
}

function classePainel(id: PassoId) {
  if (id === 'instrucoes') return 'peer-checked/instrucoes:flex'
  if (id === 'materiais') return 'peer-checked/materiais:flex'
  if (id === 'mao') return 'peer-checked/mao:flex'
  if (id === 'resumo') return 'peer-checked/resumo:flex'
  return 'peer-checked/cronograma:flex'
}

function montarPassos(cotacao: CotacaoLida, campos: Valores): Passo[] {
  const passos: Passo[] = []
  const faltam = (itens: ItemCotacao[]) =>
    itens.filter((item) => !(campos[item.codigo]?.valor ?? '').trim()).length

  if (cotacao.orientacoes.length > 0 || cotacao.legenda.length > 0) {
    passos.push({
      id: 'instrucoes',
      nome: 'Instruções',
      dica: 'Leia antes',
      resumo: 'O que a planilha explica antes de pedir valor: orientação, legenda e o que cada status significa.',
      Icon: BookOpen,
    })
  }
  if (cotacao.materiais.length > 0) {
    const vazios = faltam(cotacao.materiais)
    passos.push({
      id: 'materiais',
      nome: 'Materiais',
      dica: vazios > 0 ? `${vazios} sem valor` : `${cotacao.materiais.length} itens`,
      resumo:
        'Cada card é uma linha da aba Cotação de Materiais. A especificação, a quantidade e o local são informação. O custo unitário e a observação são o que se preenche.',
      Icon: Package,
    })
  }
  if (cotacao.maoDeObra.length > 0) {
    const vazios = faltam(cotacao.maoDeObra)
    passos.push({
      id: 'mao',
      nome: 'Mão de obra',
      dica: vazios > 0 ? `${vazios} sem valor` : `${cotacao.maoDeObra.length} itens`,
      resumo:
        'Serviços, logística e responsabilidade técnica da aba Mão de Obra. Informe o valor unitário. O total da linha é calculado.',
      Icon: HardHat,
    })
  }
  passos.push({
    id: 'resumo',
    nome: 'Resumo',
    dica: 'Calculado',
    resumo:
      'Totais por disciplina, como a aba Resumo. Nada se digita aqui: o número acompanha o que foi preenchido nas etapas anteriores.',
    Icon: ChartPie,
  })
  if (cotacao.fases.length > 0) {
    passos.push({
      id: 'cronograma',
      nome: 'Cronograma',
      dica: 'Consulta',
      resumo: 'Fases, datas e equipe que a planilha traz para situar o serviço. Esta etapa é leitura.',
      Icon: CalendarRange,
    })
  }
  return passos
}

function Instrucoes({ cotacao }: { cotacao: CotacaoLida }) {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {cotacao.titulo ? <p className="text-sm font-medium">{cotacao.titulo}</p> : null}
      {cotacao.subtitulo ? <p className="text-sm text-muted-foreground">{cotacao.subtitulo}</p> : null}
      {cotacao.preenchimento ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          {cotacao.preenchimento}
        </p>
      ) : null}
      {cotacao.orientacoes.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {cotacao.orientacoes.map((texto, indice) => (
            <li key={texto} className="flex gap-3 rounded-xl border px-3 py-2.5 text-sm">
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
              <li key={item.status} className="rounded-xl border px-3 py-2.5">
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
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-sm border border-sky-300 bg-sky-50" />
        Campo para preencher
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-sm border bg-muted" />
        Total calculado, não se digita
      </span>
    </p>
  )
}

function ListaItens({
  itens,
  origem,
  legenda,
  iniciais,
  totais,
}: {
  itens: ItemCotacao[]
  origem: 'materiais' | 'mao'
  legenda: CotacaoLida['legenda']
  iniciais: Valores
  totais: Map<string, number | null>
}) {
  const grupos = gruposDe(itens)
  const significados = new Map(legenda.map((item) => [item.status, item.texto]))
  return (
    <div className="flex flex-col gap-5">
      {grupos.map((grupo) => {
        const doGrupo = itens.filter((item) => item.grupo === grupo)
        const subtotal = doGrupo.reduce((acc, item) => acc + (totais.get(item.codigo) ?? 0), 0)
        return (
          <section key={grupo} className="flex flex-col gap-3">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium">{grupo}</h3>
              <p className="text-xs text-muted-foreground tabular-nums">
                {doGrupo.length} {doGrupo.length === 1 ? 'item' : 'itens'} ·{' '}
                <span data-subtotal={grupo}>{formatarMoedaBR(subtotal)}</span>
              </p>
            </header>
            <div className="grid gap-3 xl:grid-cols-2">
              {doGrupo.map((item) => (
                <ItemCard
                  key={item.codigo}
                  item={item}
                  origem={origem}
                  valor={iniciais[item.codigo]?.valor ?? ''}
                  observacao={iniciais[item.codigo]?.observacao ?? ''}
                  total={totais.get(item.codigo) ?? null}
                  significado={significados.get(item.status) ?? ''}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function ItemCard({
  item,
  origem,
  valor,
  observacao,
  total,
  significado,
}: {
  item: ItemCotacao
  origem: 'materiais' | 'mao'
  valor: string
  observacao: string
  total: number | null
  significado: string
}) {
  const valorId = `valor-${item.codigo}`
  const obsId = `obs-${item.codigo}`
  return (
    <article
      id={`item-${item.codigo}`}
      data-qtde={item.quantidade}
      data-grupo={item.grupo}
      data-origem={origem}
      className="flex flex-col gap-3 rounded-xl border p-4"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{item.codigo}</p>
          <h4 className="font-medium leading-snug">{item.titulo}</h4>
        </div>
        {item.status ? <StatusBadge status={item.status} titulo={significado} /> : null}
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
          <label htmlFor={valorId} className="text-sm font-medium">
            {item.rotuloValor}
          </label>
          <Input
            id={valorId}
            name={`valor:${item.codigo}`}
            defaultValue={valor}
            inputMode="decimal"
            autoComplete="off"
            aria-label={`${item.rotuloValor} de ${item.codigo}`}
            placeholder="0,00"
            className="border-sky-200 bg-sky-50/80 text-right focus-visible:border-sky-400 focus-visible:ring-sky-200"
          />
          <p className="text-xs text-muted-foreground">
            {item.unidade ? `Preço por ${item.unidade}.` : 'Preço da unidade desta linha.'}
          </p>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2 text-right">
          <p className="text-[0.7rem] text-muted-foreground">Total da linha</p>
          <p className="font-medium tabular-nums" data-total>
            {total == null ? '—' : formatarMoedaBR(total)}
          </p>
        </div>
      </div>
      {item.temObservacao ? (
        <div className="grid gap-1">
          <label htmlFor={obsId} className="text-sm font-medium">
            Observações do fornecedor
          </label>
          <textarea
            id={obsId}
            name={`obs:${item.codigo}`}
            defaultValue={observacao}
            rows={3}
            maxLength={2000}
            aria-label={`Observações de ${item.codigo}`}
            placeholder="Marca oferecida, prazo de entrega ou ressalva técnica"
            className="min-h-20 w-full rounded-lg border border-sky-200 bg-sky-50/80 px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-sky-400 focus-visible:ring-3 focus-visible:ring-sky-200"
          />
        </div>
      ) : null}
    </article>
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
  const contagem = contarStatus([...cotacao.materiais, ...cotacao.maoDeObra])
  const semValor = [...cotacao.materiais, ...cotacao.maoDeObra].filter(
    (item) => !(iniciais[item.codigo]?.valor ?? '').trim(),
  ).length

  return (
    <div className="flex max-w-3xl flex-col gap-4">
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
    <div className="flex max-w-3xl flex-col gap-4">
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

const SCRIPT_TOTAIS = `
function lerNumero(texto) {
  texto = String(texto || '').trim()
  if (!texto) return null
  if (!/^\\d{1,3}(\\.\\d{3})*(,\\d+)?$|^\\d+(,\\d+)?$/.test(texto)) return null
  var normal = texto.indexOf(',') >= 0 ? texto.replace(/\\./g, '').replace(',', '.') : texto
  var valor = Number(normal)
  return Number.isFinite(valor) ? valor : null
}
function moeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function atualizarTotais() {
  var grupos = {}
  var materiais = 0
  var mao = 0
  document.querySelectorAll('article[data-qtde]').forEach(function (artigo) {
    var qtde = lerNumero(artigo.getAttribute('data-qtde'))
    var campo = artigo.querySelector('input[name^="valor:"]')
    var unitario = campo ? lerNumero(campo.value) : null
    var total = qtde == null || unitario == null ? null : Math.round((qtde * unitario + Number.EPSILON) * 100) / 100
    var alvo = artigo.querySelector('[data-total]')
    if (alvo) alvo.textContent = total == null ? '—' : moeda(total)
    var grupo = artigo.getAttribute('data-grupo') || ''
    var numero = total == null ? 0 : total
    if (artigo.getAttribute('data-origem') === 'materiais') {
      materiais += numero
      grupos[grupo] = (grupos[grupo] || 0) + numero
    } else {
      mao += numero
    }
  })
  document.querySelectorAll('[data-subtotal]').forEach(function (el) {
    var grupo = el.getAttribute('data-subtotal')
    if (grupo && grupos[grupo] != null) el.textContent = moeda(grupos[grupo])
  })
  document.querySelectorAll('[data-resumo]').forEach(function (el) {
    var chave = el.getAttribute('data-resumo')
    if (chave && grupos[chave] != null) el.textContent = moeda(grupos[chave])
  })
  document.querySelectorAll('[data-percent]').forEach(function (el) {
    var chave = el.getAttribute('data-percent')
    var valor = chave ? grupos[chave] : null
    el.textContent = materiais > 0 && valor != null ? ((valor / materiais) * 100).toFixed(1).replace('.', ',') + '%' : '—'
  })
  var geral = materiais + mao
  var mapa = { geral: moeda(geral), materiais: moeda(materiais), mao: moeda(mao), 'materiais-tabela': moeda(materiais), 'mao-tabela': moeda(mao), 'geral-tabela': moeda(geral) }
  Object.keys(mapa).forEach(function (chave) {
    document.querySelectorAll('[data-resumo="' + chave + '"]').forEach(function (el) {
      el.textContent = mapa[chave]
    })
  })
}
document.addEventListener('input', atualizarTotais)
`

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

function contarStatus(itens: ItemCotacao[]) {
  const mapa = new Map<string, number>()
  for (const item of itens) {
    if (!item.status) continue
    mapa.set(item.status, (mapa.get(item.status) ?? 0) + 1)
  }
  return [...mapa.entries()].map(([status, quantidade]) => ({ status, quantidade }))
}
