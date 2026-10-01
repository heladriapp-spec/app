'use client'

import { salvarPreenchimento } from '@/app/actions/projetos'
import { baixarPlanilha } from '@/components/baixar-planilha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { LinhaPlanilha } from '@/lib/planilha/ler'
import { formatarNumeroBR, lerNumeroBR } from '@/lib/planilha/numeros'
import { lancamentoDaLinha } from '@/lib/projetos/lancamento'
import type { Lancamento, Projeto } from '@/lib/projetos/tipos'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Capitulo = {
  id: string
  nome: string
  itens: LinhaPlanilha[]
}

function conta(quantidade: string, material: string, maoDeObra: string) {
  const qtde = lerNumeroBR(quantidade)
  const mat = lerNumeroBR(material)
  const mao = lerNumeroBR(maoDeObra)
  const unitario = mat != null || mao != null ? (mat ?? 0) + (mao ?? 0) : null
  const totalMaterial = qtde != null && mat != null ? qtde * mat : null
  const totalMao = qtde != null && mao != null ? qtde * mao : null
  const total =
    totalMaterial != null || totalMao != null ? (totalMaterial ?? 0) + (totalMao ?? 0) : null
  return { unitario, totalMaterial, totalMao, total }
}

function texto(valor: number | null) {
  return valor == null ? '—' : formatarNumeroBR(valor)
}

export function PlanilhaTela({ projeto, linhas }: { projeto: Projeto; linhas: LinhaPlanilha[] }) {
  const capitulos = capitulosDe(linhas)
  const [valores, setValores] = useState(() => valoresIniciais(projeto, linhas))
  const [aberto, setAberto] = useState(capitulos[0]?.id ?? '')
  const [aviso, setAviso] = useState('')
  const [baixando, setBaixando] = useState(false)
  const router = useRouter()
  const atual = capitulos.find((item) => item.id === aberto) ?? capitulos[0]
  if (!atual) return null

  function alterar(chave: string, campo: Partial<Lancamento>) {
    setValores((prev) => ({
      ...prev,
      [chave]: { ...prev[chave], ...campo },
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

  return (
    <form action={salvarPreenchimento} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={projeto.id} />
      <div className="grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <nav className="flex flex-col gap-1 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:pr-1">
          <p className="px-2.5 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Capítulos
          </p>
          <p className="px-2.5 pb-2 text-[0.7rem] leading-snug text-muted-foreground">
            Verde, capítulo preenchido. Laranja, ainda falta valor.
          </p>
          {capitulos.map((item, indice) => {
            const preenchido = capituloPreenchido(item, valores)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setAberto(item.id)}
                className={classeCapitulo(preenchido, item.id === atual.id)}
                aria-current={item.id === atual.id ? 'page' : undefined}
              >
                <span className="w-5 shrink-0 text-xs tabular-nums opacity-70">{indice + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.nome}</span>
                  <span className="block truncate text-[0.7rem] opacity-70">
                    {dica(item, valores)}
                  </span>
                </span>
              </button>
            )
          })}
        </nav>
        {capitulos.map((item, indice) => {
          const anterior = indice > 0 ? capitulos[indice - 1] : null
          const proximo = indice < capitulos.length - 1 ? capitulos[indice + 1] : null
          return (
            <section
              key={item.id}
              className={cn('min-w-0 flex-col gap-3', item.id === atual.id ? 'flex' : 'hidden')}
            >
              <div>
                <p className="text-xs text-muted-foreground">
                  {indice + 1} de {capitulos.length}
                </p>
                <h2 className="text-lg font-semibold">{item.nome}</h2>
              </div>
              <Tabela itens={item.itens} valores={valores} onAlterar={alterar} />
              {aviso ? <p className="text-sm text-destructive">{aviso}</p> : null}
              <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t bg-background/95 py-3 backdrop-blur">
                {anterior ? (
                  <Button type="button" variant="outline" onClick={() => setAberto(anterior.id)}>
                    <ChevronLeft data-icon="inline-start" />
                    {anterior.nome}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Preço vazio continua vazio. Zero digitado fica zero.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="outline">
                    Salvar preenchimento
                  </Button>
                  <Button
                    type="button"
                    disabled={baixando}
                    onClick={(evento) => {
                      const form = evento.currentTarget.form
                      if (form) void aoBaixar(form)
                    }}
                  >
                    {baixando ? 'Preparando…' : 'Baixar planilha'}
                  </Button>
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

function Tabela({
  itens,
  valores,
  onAlterar,
}: {
  itens: LinhaPlanilha[]
  valores: Record<string, Lancamento>
  onAlterar: (chave: string, campo: Partial<Lancamento>) => void
}) {
  const somas = itens.reduce(
    (acc, linha) => {
      const campos = valores[String(linha.linha)]
      const totais = conta(campos?.quantidade ?? '', campos?.material ?? '', campos?.maoDeObra ?? '')
      acc.material += totais.totalMaterial ?? 0
      acc.mao += totais.totalMao ?? 0
      return acc
    },
    { material: 0, mao: 0 },
  )

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-2 py-2 font-medium">Item</th>
            <th className="px-2 py-2 font-medium">Código</th>
            <th className="px-2 py-2 font-medium">Descrição</th>
            <th className="px-2 py-2 font-medium">Un.</th>
            <th className="px-2 py-2 font-medium">Qtd.</th>
            <th className="px-2 py-2 font-medium">Material</th>
            <th className="px-2 py-2 font-medium">Mão de obra</th>
            <th className="px-2 py-2 font-medium">Total unit.</th>
            <th className="px-2 py-2 font-medium">Total material</th>
            <th className="px-2 py-2 font-medium">Total mão de obra</th>
            <th className="px-2 py-2 font-medium">Total da linha</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((linha) => {
            const campos = valores[String(linha.linha)] ?? {
              quantidade: '',
              material: '',
              maoDeObra: '',
            }
            const totais = conta(campos.quantidade, campos.material, campos.maoDeObra)
            const chave = String(linha.linha)
            return (
              <tr key={linha.linha} className="border-t">
                <td className="px-2 py-1.5 tabular-nums">{linha.item}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{linha.codigo}</td>
                <td className="max-w-md px-2 py-1.5">{linha.descricao}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{linha.unidade}</td>
                <td className="px-2 py-1.5">
                  <Input
                    name={`qtde:${chave}`}
                    value={campos.quantidade}
                    onChange={(evento) => onAlterar(chave, { quantidade: evento.target.value })}
                    inputMode="decimal"
                    aria-label={`Quantidade ${linha.codigo}`}
                    className="w-20 text-right"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    name={`material:${chave}`}
                    value={campos.material}
                    onChange={(evento) => onAlterar(chave, { material: evento.target.value })}
                    inputMode="decimal"
                    aria-label={`Material ${linha.codigo}`}
                    className="w-24 text-right"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    name={`mao:${chave}`}
                    value={campos.maoDeObra}
                    onChange={(evento) => onAlterar(chave, { maoDeObra: evento.target.value })}
                    inputMode="decimal"
                    aria-label={`Mão de obra ${linha.codigo}`}
                    className="w-24 text-right"
                  />
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{texto(totais.unitario)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{texto(totais.totalMaterial)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{texto(totais.totalMao)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{texto(totais.total)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t font-medium">
            <td className="px-2 py-2" colSpan={8}>
              Total do capítulo
            </td>
            <td className="px-2 py-2 text-right tabular-nums">{formatarNumeroBR(somas.material)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{formatarNumeroBR(somas.mao)}</td>
            <td className="px-2 py-2 text-right tabular-nums">
              {formatarNumeroBR(somas.material + somas.mao)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function capitulosDe(linhas: LinhaPlanilha[]): Capitulo[] {
  const capitulos: Capitulo[] = []
  let atual: Capitulo | null = null
  const soltos: LinhaPlanilha[] = []
  for (const linha of linhas) {
    if (linha.grupo) {
      atual = {
        id: String(linha.linha),
        nome: [linha.codigo, linha.descricao].filter(Boolean).join(' · '),
        itens: [],
      }
      capitulos.push(atual)
      continue
    }
    if (atual) atual.itens.push(linha)
    else soltos.push(linha)
  }
  if (soltos.length > 0) {
    capitulos.unshift({ id: 'itens', nome: 'Itens', itens: soltos })
  }
  const comItens = capitulos.filter((item) => item.itens.length > 0)
  return comItens.length > 0 ? comItens : [{ id: 'itens', nome: 'Itens', itens: linhas.filter((linha) => !linha.grupo) }]
}

function capituloPreenchido(capitulo: Capitulo, valores: Record<string, Lancamento>) {
  if (capitulo.itens.length === 0) return false
  return capitulo.itens.every((linha) => {
    const campos = valores[String(linha.linha)]
    return Boolean(campos?.material.trim() && campos.maoDeObra.trim())
  })
}

function dica(capitulo: Capitulo, valores: Record<string, Lancamento>) {
  const faltam = capitulo.itens.filter((linha) => {
    const campos = valores[String(linha.linha)]
    return !campos?.material.trim() || !campos.maoDeObra.trim()
  }).length
  if (faltam === 0) return `${capitulo.itens.length} itens · preenchido`
  return `${faltam} sem valor`
}

function classeCapitulo(preenchido: boolean, ativo: boolean) {
  return cn(
    'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left',
    preenchido ? 'border-emerald-400 bg-emerald-50 text-emerald-950' : 'border-amber-400 bg-amber-50 text-amber-950',
    ativo && 'ring-2 ring-foreground',
  )
}

function valoresIniciais(projeto: Projeto, linhas: LinhaPlanilha[]) {
  const mapa: Record<string, Lancamento> = {}
  for (const linha of linhas) {
    if (linha.grupo) continue
    mapa[String(linha.linha)] = lancamentoDaLinha(projeto, linha.linha, linha)
  }
  return mapa
}
