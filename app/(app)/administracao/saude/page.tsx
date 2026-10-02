import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { GestaoAtalhos } from '@/components/gestao-atalhos'
import { NotaOperacao } from '@/components/nota-operacao'
import { SaudePainel } from '@/components/saude-painel'
import { montarRelatorioSaude } from '@/lib/saude/executar'
import { HeartPulse } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SaudeAdminPage() {
  const relatorio = await montarRelatorioSaude()
  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina
        titulo="Saúde"
        icone={HeartPulse}
        acoes={<GestaoAtalhos atual="/administracao/saude" />}
      >
        Ambiente deste processo e o que o produto Heladri já precisa ter na pasta.
      </CabecalhoPagina>
      <NotaOperacao />
      <SaudePainel relatorio={relatorio} completo />
    </div>
  )
}
