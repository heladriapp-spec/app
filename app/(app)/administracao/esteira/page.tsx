import { EsteiraPainel } from '@/components/esteira-painel'
import { NotaOperacao } from '@/components/nota-operacao'
import { carregarPainelEsteira } from '@/lib/entregas/carregar'

export default async function EsteiraPage() {
  const painel = await carregarPainelEsteira()
  return (
    <div className="flex flex-col gap-4">
      <NotaOperacao />
      <EsteiraPainel painel={painel} />
    </div>
  )
}
