import type { Lancamento } from '@/lib/projetos/tipos'

export function lancamentosIguais(
  atual: Record<string, Lancamento>,
  proximo: Record<string, Lancamento>,
) {
  const chaves = new Set([...Object.keys(atual), ...Object.keys(proximo)])
  for (const chave of chaves) {
    const antes = atual[chave]
    const depois = proximo[chave]
    if (!antes || !depois) return false
    if (texto(antes.quantidade) !== texto(depois.quantidade)) return false
    if (texto(antes.material) !== texto(depois.material)) return false
    if (texto(antes.maoDeObra) !== texto(depois.maoDeObra)) return false
    if (texto(antes.valor) !== texto(depois.valor)) return false
    if (texto(antes.observacao) !== texto(depois.observacao)) return false
    if (texto(antes.valorBase) !== texto(depois.valorBase)) return false
    if (texto(antes.status) !== texto(depois.status)) return false
    if (extrasTexto(antes.extras) !== extrasTexto(depois.extras)) return false
  }
  return true
}

function extrasTexto(extras: { id: string; reais: number | null; percentual: number | null }[] | undefined) {
  if (!extras?.length) return ''
  return JSON.stringify(
    extras.map((item) => ({ id: item.id, reais: item.reais, percentual: item.percentual })),
  )
}

function texto(valor: string | undefined) {
  return valor ?? ''
}

export function lancamentoDaLinha(
  projeto: { lancamentos: Record<string, Lancamento> },
  linha: number,
  origem: { quantidade: string; material: string; maoDeObra: string },
): Lancamento {
  return (
    projeto.lancamentos[String(linha)] ?? {
      quantidade: origem.quantidade,
      material: origem.material,
      maoDeObra: origem.maoDeObra,
    }
  )
}
