import { GestaoAtalhos } from '@/components/gestao-atalhos'
import { NotaOperacao } from '@/components/nota-operacao'
import { SaudePainel } from '@/components/saude-painel'
import { montarRelatorioSaude } from '@/lib/saude/executar'
import { HeartPulse } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SaudeAdminPage() {
  const relatorio = await montarRelatorioSaude()
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold md:text-xl">
            <HeartPulse className="size-5 text-muted-foreground" />
            Saúde
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ambiente deste processo e o que o produto Heladri já precisa ter na pasta.
          </p>
        </div>
        <GestaoAtalhos atual="/administracao/saude" />
      </div>
      <NotaOperacao />
      <SaudePainel relatorio={relatorio} completo />
    </div>
  )
}
