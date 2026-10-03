'use client'

import { excluirItem, reincluirItem, salvarPreenchimento } from '@/app/actions/projetos'
import { AcoesPreenchimento } from '@/components/acoes-preenchimento'
import { NotaArquivoReferencial } from '@/components/arquivo-referencial'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { LinhaPlanilha } from '@/lib/planilha/ler'
import { formatarNumeroBR, lerNumeroBR } from '@/lib/planilha/numeros'
import { lancamentoDaLinha } from '@/lib/projetos/lancamento'
import type { Lancamento, Projeto } from '@/lib/projetos/tipos'
import { cn } from '@/lib/utils'
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'

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

export function PlanilhaTela({
  projeto,
  linhas,
  salvo = false,
  podeExcluir = false,
  etapa = 'preparacao',
  mostrarArquivo = true,
}: {
  projeto: Projeto
  linhas: LinhaPlanilha[]
  salvo?: boolean
  podeExcluir?: boolean
  etapa?: 'preparacao' | 'execucao'
  mostrarArquivo?: boolean
}) {
  const capitulos = capitulosDe(linhas)
  const [valores, setValores] = useState(() => valoresIniciais(projeto, linhas))
  const [aberto, setAberto] = useState(capitulos[0]?.id ?? '')
  const [indo, setIndo] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const fora = linhas.filter((linha) => !linha.grupo && valores[String(linha.linha)]?.excluido)
  const capitulosVisiveis = capitulos
    .map((capitulo) => ({
      ...capitulo,
      itens: capitulo.itens.filter((linha) => !valores[String(linha.linha)]?.excluido),
    }))
    .filter((capitulo) => capitulo.itens.length > 0)
  const atual = capitulosVisiveis.find((item) => item.id === aberto) ?? capitulosVisiveis[0]

  function ir(id: string) {
    setIndo(id)
    iniciar(() => setAberto(id))
  }

  function alterar(chave: string, campo: Partial<Lancamento>) {
    setValores((prev) => ({
      ...prev,
      [chave]: { ...prev[chave], ...campo },
    }))
  }

  return (
    <div className="flex flex-col gap-4">
      {podeExcluir
        ? linhas
            .filter((linha) => !linha.grupo && !valores[String(linha.linha)]?.excluido)
            .map((linha) => {
              const chave = String(linha.linha)
              return (
                <form key={chave} id={idFormulario(chave)} action={excluirItem}>
                  <input type="hidden" name="id" value={projeto.id} />
                  <input type="hidden" name="item" value={chave} />
                </form>
              )
            })
        : null}
      {atual ? (
    <form action={salvarPreenchimento} data-aviso="silencioso" className="flex flex-col gap-4">
      <input type="hidden" name="id" value={projeto.id} />
      <NotaArquivoReferencial
        nome={mostrarArquivo ? projeto.arquivoNome : null}
        projetoId={projeto.id}
      />
      <nav aria-label="Capítulos" className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">Verde, preenchido. Laranja, ainda falta valor.</p>
        <div className="flex gap-2.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
          {capitulosVisiveis.map((item, indice) => {
            const preenchido = capituloPreenchido(item, valores)
            const ativo = item.id === atual.id
            return (
              <button
                key={item.id}
                type="button"
                title={item.nome}
                onClick={() => ir(item.id)}
                aria-current={ativo ? 'page' : undefined}
                className={cn(
                  'inline-flex max-w-60 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                  preenchido
                    ? 'border-emerald-500/70 bg-emerald-50 text-emerald-950'
                    : 'border-amber-500/80 bg-amber-50 text-amber-950',
                  ativo && 'ring-2 ring-primary',
                )}
              >
                <span className="text-xs tabular-nums opacity-60">{indice + 1}</span>
                {pendente && indo === item.id ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                ) : preenchido ? (
                  <Check className="size-3.5 shrink-0" aria-hidden />
                ) : null}
                <span className="truncate">{pendente && indo === item.id ? 'Carregando' : item.nome}</span>
              </button>
            )
          })}
        </div>
      </nav>
      <div className="flex flex-col gap-4">
        {capitulosVisiveis.map((item, indice) => {
          const anterior = indice > 0 ? capitulosVisiveis[indice - 1] : null
          const proximo = indice < capitulosVisiveis.length - 1 ? capitulosVisiveis[indice + 1] : null
          return (
            <section
              key={item.id}
              className={cn('min-w-0 flex-col gap-4', item.id === atual.id ? 'flex' : 'hidden')}
            >
              <div>
                <p className="text-xs text-muted-foreground">
                  {indice + 1} de {capitulosVisiveis.length}
                </p>
                <h2 className="text-xl font-semibold tracking-tight">{item.nome}</h2>
              </div>
              <Tabela itens={item.itens} valores={valores} onAlterar={alterar} podeExcluir={podeExcluir} />
              <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 px-4 py-4 shadow-sm backdrop-blur">
                {anterior ? (
                  <Button type="button" variant="outline" onClick={() => ir(anterior.id)}>
                    {pendente && indo === anterior.id ? (
                      <Loader2 className="animate-spin" data-icon="inline-start" />
                    ) : (
                      <ChevronLeft data-icon="inline-start" />
                    )}
                    {pendente && indo === anterior.id ? 'Carregando' : anterior.nome}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Preço vazio continua vazio. Zero digitado fica zero.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <AcoesPreenchimento salvo={salvo} etapa={etapa} />
                  {proximo ? (
                    <Button type="button" onClick={() => ir(proximo.id)}>
                      {pendente && indo === proximo.id ? 'Carregando' : proximo.nome}
                      {pendente && indo === proximo.id ? (
                        <Loader2 className="animate-spin" data-icon="inline-end" />
                      ) : (
                        <ChevronRight data-icon="inline-end" />
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </form>
      ) : (
        <p className="text-sm text-muted-foreground">Todos os itens saíram deste trabalho.</p>
      )}
      {fora.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-medium">Itens fora deste trabalho</h2>
          <ul className="flex flex-col gap-2">
            {fora.map((linha) => (
              <li key={linha.linha} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {linha.codigo} · {linha.descricao}
                </span>
                {podeExcluir ? (
                  <form action={reincluirItem}>
                    <input type="hidden" name="id" value={projeto.id} />
                    <input type="hidden" name="item" value={String(linha.linha)} />
                    <Button type="submit" variant="outline" size="xs">
                      Reincluir
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function idFormulario(item: string) {
  return `item-fora-${item.replace(/[^\w-]/g, '-')}`
}

function Tabela({
  itens,
  valores,
  onAlterar,
  podeExcluir,
}: {
  itens: LinhaPlanilha[]
  valores: Record<string, Lancamento>
  onAlterar: (chave: string, campo: Partial<Lancamento>) => void
  podeExcluir: boolean
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
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead className="bg-muted/70 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-3 font-medium">Item</th>
            <th className="px-3 py-3 font-medium">Código</th>
            <th className="px-3 py-3 font-medium">Descrição</th>
            <th className="px-3 py-3 font-medium">Un.</th>
            <th className="px-3 py-3 font-medium">Qtd.</th>
            <th className="px-3 py-3 font-medium">Material</th>
            <th className="px-3 py-3 font-medium">Mão de obra</th>
            <th className="px-3 py-3 font-medium">Total unit.</th>
            <th className="px-3 py-3 font-medium">Total material</th>
            <th className="px-3 py-3 font-medium">Total mão de obra</th>
            <th className="px-3 py-3 font-medium">Total da linha</th>
            {podeExcluir ? <th className="px-3 py-3 font-medium"> </th> : null}
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
                <td className="px-3 py-3 tabular-nums">{linha.item}</td>
                <td className="px-3 py-3 whitespace-nowrap">{linha.codigo}</td>
                <td className="max-w-md px-3 py-3">{linha.descricao}</td>
                <td className="px-3 py-3 whitespace-nowrap">{linha.unidade}</td>
                <td className="px-3 py-3">
                  <Input
                    name={`qtde:${chave}`}
                    value={campos.quantidade}
                    onChange={(evento) => onAlterar(chave, { quantidade: evento.target.value })}
                    inputMode="decimal"
                    aria-label={`Quantidade ${linha.codigo}`}
                    className="w-20 text-right"
                  />
                </td>
                <td className="px-3 py-3">
                  <Input
                    name={`material:${chave}`}
                    value={campos.material}
                    onChange={(evento) => onAlterar(chave, { material: evento.target.value })}
                    inputMode="decimal"
                    aria-label={`Material ${linha.codigo}`}
                    className="w-24 text-right"
                  />
                </td>
                <td className="px-3 py-3">
                  <Input
                    name={`mao:${chave}`}
                    value={campos.maoDeObra}
                    onChange={(evento) => onAlterar(chave, { maoDeObra: evento.target.value })}
                    inputMode="decimal"
                    aria-label={`Mão de obra ${linha.codigo}`}
                    className="w-24 text-right"
                  />
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{texto(totais.unitario)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{texto(totais.totalMaterial)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{texto(totais.totalMao)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{texto(totais.total)}</td>
                {podeExcluir ? (
                  <td className="px-3 py-3">
                    <Button type="submit" form={idFormulario(chave)} variant="outline" size="xs">
                      Excluir
                    </Button>
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t font-medium">
            <td className="px-3 py-3" colSpan={podeExcluir ? 9 : 8}>
              Total do capítulo
            </td>
            <td className="px-3 py-3 text-right tabular-nums">{formatarNumeroBR(somas.material)}</td>
            <td className="px-3 py-3 text-right tabular-nums">{formatarNumeroBR(somas.mao)}</td>
            <td className="px-3 py-3 text-right tabular-nums">
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

function valoresIniciais(projeto: Projeto, linhas: LinhaPlanilha[]) {
  const mapa: Record<string, Lancamento> = {}
  for (const linha of linhas) {
    if (linha.grupo) continue
    mapa[String(linha.linha)] = lancamentoDaLinha(projeto, linha.linha, linha)
  }
  return mapa
}
