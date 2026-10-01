import type { Lancamento } from '@/lib/projetos/tipos'

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
