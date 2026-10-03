import { rotuloExtra } from '@/lib/planilha/extra'
import type { PlanilhaLida } from '@/lib/planilha/ler'
import type { ExtraServico, Lancamento } from '@/lib/projetos/tipos'

/** Estado dos campos e das linhas fora. Não é o arquivo. */
export type EstadoItem = {
  quantidade?: string
  material?: string
  maoDeObra?: string
  valor?: string
  observacao?: string
  status?: string
  valorBase?: string
  extras?: ExtraServico[]
  excluido?: true
}

export type EstadoPlanilha = Record<string, EstadoItem>

export type Mudanca =
  | {
      tipo: 'campo'
      item: string
      rotulo: string
      campo: string
      anterior: string
      novo: string
    }
  | { tipo: 'excluiu_item' | 'reincluiu_item'; item: string; rotulo: string }

const CAMPOS: { chave: keyof Lancamento; nome: string }[] = [
  { chave: 'quantidade', nome: 'Quantidade' },
  { chave: 'material', nome: 'Material' },
  { chave: 'maoDeObra', nome: 'Mão de obra' },
  { chave: 'valor', nome: 'Valor' },
  { chave: 'observacao', nome: 'Observação' },
  { chave: 'status', nome: 'Status' },
  { chave: 'valorBase', nome: 'Valor base' },
]

export function rotulosDaPlanilha(lida: PlanilhaLida) {
  const mapa: Record<string, string> = {}
  if (lida.formato === 'cotacao' && lida.cotacao) {
    for (const item of [...lida.cotacao.materiais, ...lida.cotacao.maoDeObra]) {
      mapa[item.codigo] = encurtar([item.codigo, item.titulo].filter(Boolean).join(' · '))
    }
    return mapa
  }
  for (const linha of lida.linhas) {
    if (linha.grupo) continue
    mapa[String(linha.linha)] = encurtar([linha.codigo, linha.descricao].filter(Boolean).join(' · '))
  }
  return mapa
}

export function itemDaPlanilha(lida: PlanilhaLida, item: string) {
  return Object.prototype.hasOwnProperty.call(rotulosDaPlanilha(lida), item)
}

export function estadoDe(lancamentos: Record<string, Lancamento>): EstadoPlanilha {
  const estado: EstadoPlanilha = {}
  for (const [chave, item] of Object.entries(lancamentos)) {
    const compacto = compactar(item)
    if (compacto) estado[chave] = compacto
  }
  return estado
}

export function diferencas(
  antes: Record<string, Lancamento>,
  depois: Record<string, Lancamento>,
  rotulos: Record<string, string>,
): Mudanca[] {
  const mudancas: Mudanca[] = []
  const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)])
  for (const item of [...chaves].sort()) {
    const rotulo = rotulos[item] || item
    const antigo = antes[item]
    const novo = depois[item]
    if (Boolean(antigo?.excluido) !== Boolean(novo?.excluido)) {
      mudancas.push({
        tipo: novo?.excluido ? 'excluiu_item' : 'reincluiu_item',
        item,
        rotulo,
      })
    }
    for (const campo of CAMPOS) {
      const anterior = texto(antigo?.[campo.chave])
      const atual = texto(novo?.[campo.chave])
      if (anterior === atual) continue
      mudancas.push({ tipo: 'campo', item, rotulo, campo: campo.nome, anterior, novo: atual })
    }
    const extrasAntes = textoExtras(antigo?.extras)
    const extrasDepois = textoExtras(novo?.extras)
    if (extrasAntes !== extrasDepois) {
      mudancas.push({
        tipo: 'campo',
        item,
        rotulo,
        campo: 'Extra',
        anterior: extrasAntes,
        novo: extrasDepois,
      })
    }
  }
  return mudancas
}

/** Linha fora permanece como estava. O formulário não a reenvia. */
export function preservarExcluidos(
  antes: Record<string, Lancamento>,
  recebidos: Record<string, Lancamento>,
) {
  const depois = { ...recebidos }
  for (const [chave, item] of Object.entries(antes)) {
    if (item.excluido) depois[chave] = item
  }
  return depois
}

export function aplicarEstado(
  atual: Record<string, Lancamento>,
  estado: EstadoPlanilha,
): Record<string, Lancamento> {
  const chaves = new Set([...Object.keys(atual), ...Object.keys(estado)])
  const saida: Record<string, Lancamento> = {}
  for (const chave of chaves) {
    const base = atual[chave]
    const snap = estado[chave]
    const item: Lancamento = {
      quantidade: snap?.quantidade ?? '',
      material: snap?.material ?? '',
      maoDeObra: snap?.maoDeObra ?? '',
    }
    if (snap?.valor !== undefined || base?.valor !== undefined) item.valor = snap?.valor ?? ''
    if (snap?.observacao !== undefined || base?.observacao !== undefined) {
      item.observacao = snap?.observacao ?? ''
    }
    if (snap?.status !== undefined || base?.status !== undefined) item.status = snap?.status ?? ''
    if (snap?.valorBase !== undefined || base?.valorBase !== undefined) {
      item.valorBase = snap?.valorBase ?? ''
    }
    if (snap?.extras?.length) item.extras = snap.extras
    else if (base?.extras?.length) item.extras = []
    if (snap?.excluido) item.excluido = true
    saida[chave] = item
  }
  return saida
}

export function textoDaMudanca(mudanca: Mudanca) {
  if (mudanca.tipo === 'excluiu_item') return `${mudanca.rotulo} saiu do trabalho.`
  if (mudanca.tipo === 'reincluiu_item') return `${mudanca.rotulo} voltou ao trabalho.`
  if (mudanca.tipo !== 'campo') return mudanca.rotulo
  const anterior = mudanca.anterior || 'vazio'
  const novo = mudanca.novo || 'vazio'
  return `${mudanca.rotulo} · ${mudanca.campo}: ${anterior} → ${novo}`
}

function compactar(item: Lancamento): EstadoItem | null {
  const estado: EstadoItem = {}
  if (item.quantidade.trim()) estado.quantidade = item.quantidade.trim()
  if (item.material.trim()) estado.material = item.material.trim()
  if (item.maoDeObra.trim()) estado.maoDeObra = item.maoDeObra.trim()
  if (item.valor?.trim()) estado.valor = item.valor.trim()
  if (item.observacao?.trim()) estado.observacao = item.observacao.trim()
  if (item.status?.trim()) estado.status = item.status.trim()
  if (item.valorBase?.trim()) estado.valorBase = item.valorBase.trim()
  if (item.extras?.length) estado.extras = item.extras
  if (item.excluido) estado.excluido = true
  return Object.keys(estado).length > 0 ? estado : null
}

function texto(valor: unknown) {
  return typeof valor === 'string' ? valor.trim() : ''
}

function textoExtras(extras: ExtraServico[] | undefined) {
  if (!extras?.length) return ''
  return extras.map((item) => rotuloExtra(item)).filter(Boolean).join('; ')
}

function encurtar(textoBruto: string) {
  const limpo = textoBruto.replace(/\s+/g, ' ').trim()
  return limpo.length > 120 ? `${limpo.slice(0, 117)}…` : limpo
}
