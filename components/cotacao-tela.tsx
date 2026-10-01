'use client'

import { salvarPreenchimento } from '@/app/actions/projetos'
import { AcoesPreenchimento } from '@/components/acoes-preenchimento'
import { NotaArquivoReferencial } from '@/components/arquivo-referencial'
import { baixarPlanilha } from '@/components/baixar-planilha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CotacaoLida, FaseCronograma, ItemCotacao } from '@/lib/planilha/cotacao'
import { formatarMoedaBR, lerNumeroBR } from '@/lib/planilha/numeros'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Valores = Record<string, { valor: string; observacao: string }>

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

  function alterar(codigo: string, campo: Partial<Valores[string]>) {
    setValores((prev) => ({
      ...prev,
      [codigo]: {
        valor: prev[codigo]?.valor ?? '',
        observacao: prev[codigo]?.observacao ?? '',
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
    <form action={salvarPreenchimento} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={projetoId} />
      <NotaArquivoReferencial nome={arquivoNome} />
      <div className="grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <nav className="flex flex-col gap-1 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:pr-1">
          <p className="px-2.5 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Capítulos
          </p>
          <p className="px-2.5 pb-2 text-[0.7rem] leading-snug text-muted-foreground">
            Verde, capítulo preenchido. Laranja, ainda falta valor.
          </p>
          {capitulos.map((item, indice) => {
            const estado = capituloPreenchido(item, cotacao, valores)
            const anterior = indice > 0 ? capitulos[indice - 1] : null
            const quebra = anterior == null || anterior.kicker !== item.kicker
            return (
              <div key={item.id} className="contents">
                {quebra ? (
                  <p className="px-2.5 pt-3 pb-1 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
                    {item.kicker}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setAberto(item.id)}
                  className={classeCapitulo(estado, item.id === atual.id)}
                  aria-current={item.id === atual.id ? 'page' : undefined}
                >
                  <span className="w-5 shrink-0 text-xs tabular-nums opacity-70">{indice + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.nome}</span>
                    <span className="block truncate text-[0.7rem] opacity-70">
                      {dicaCapitulo(item, cotacao, valores)}
                    </span>
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
              className={cn('min-w-0 flex-col gap-4', item.id === atual.id ? 'flex' : 'hidden')}
            >
              <div>
                <p className="text-xs text-muted-foreground">
                  {item.kicker} · {indice + 1} de {capitulos.length}
                </p>
                <h2 className="text-lg font-semibold">{item.nome}</h2>
                {itens.length > 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                    {itens.length} {itens.length === 1 ? 'item' : 'itens'} · {formatarMoedaBR(subtotal)}
                  </p>
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
              {aviso ? <p className="text-sm text-destructive">{aviso}</p> : null}
              <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex flex-wrap items-center justify-between gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:px-0">
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

function classeCapitulo(preenchido: boolean | null, ativo: boolean) {
  return cn(
    'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left',
    preenchido === true && 'border-emerald-400 bg-emerald-50 text-emerald-950',
    preenchido === false && 'border-amber-400 bg-amber-50 text-amber-950',
    preenchido === null && 'border-border bg-background',
    ativo && 'ring-2 ring-foreground',
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
    lista.push({ id: 'cronograma', nome: 'Cronograma', kicker: 'Leitura', origem: 'cronograma' })
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

function dicaCapitulo(capitulo: Capitulo, cotacao: CotacaoLida, valores: Valores) {
  if (capitulo.origem !== 'materiais' && capitulo.origem !== 'mao') return capitulo.kicker
  const fonte = capitulo.origem === 'materiais' ? cotacao.materiais : cotacao.maoDeObra
  const itens = fonte.filter((item) => item.grupo === capitulo.grupo)
  const faltam = itens.filter((item) => !(valores[item.codigo]?.valor ?? '').trim()).length
  if (faltam === 0) return `${itens.length} ${itens.length === 1 ? 'item' : 'itens'} · preenchido`
  return `${faltam} sem valor`
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
  valores,
  totais,
  onAlterar,
}: {
  itens: ItemCotacao[]
  origem: 'materiais' | 'mao'
  legenda: CotacaoLida['legenda']
  valores: Valores
  totais: Map<string, number | null>
  onAlterar: (codigo: string, campo: Partial<Valores[string]>) => void
}) {
  const significados = new Map(legenda.map((item) => [item.status, item.texto]))
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {itens.map((item) => (
        <ItemCard
          key={item.codigo}
          item={item}
          origem={origem}
          valor={valores[item.codigo]?.valor ?? ''}
          observacao={valores[item.codigo]?.observacao ?? ''}
          total={totais.get(item.codigo) ?? null}
          significado={significados.get(item.status) ?? ''}
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
  observacao,
  total,
  significado,
  onAlterar,
}: {
  item: ItemCotacao
  origem: 'materiais' | 'mao'
  valor: string
  observacao: string
  total: number | null
  significado: string
  onAlterar: (codigo: string, campo: Partial<Valores[string]>) => void
}) {
  const valorId = `valor-${item.codigo}`
  const obsId = `obs-${item.codigo}`
  return (
    <article
      id={`item-${item.codigo}`}
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
            value={valor}
            onChange={(evento) => onAlterar(item.codigo, { valor: evento.target.value })}
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
            value={observacao}
            onChange={(evento) => onAlterar(item.codigo, { observacao: evento.target.value })}
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
