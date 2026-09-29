import { SaudePainel } from '@/components/saude-painel'
import { montarRelatorioSaude } from '@/lib/saude/executar'

export const dynamic = 'force-dynamic'

export default async function SaudePublicaPage() {
  const relatorio = await montarRelatorioSaude()
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <div>
        <p className="text-sm font-semibold">Heladri</p>
        <h1 className="text-xl font-semibold">Saúde do ambiente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sonda do processo. O detalhe e a fila de entregas ficam com o administrador.
        </p>
      </div>
      <SaudePainel relatorio={relatorio} />
    </main>
  )
}
