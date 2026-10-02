import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { GestaoAtalhos } from '@/components/gestao-atalhos'
import { NotaOperacao } from '@/components/nota-operacao'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { dataHoraBR } from '@/lib/formato'
import { EVENTO_LABEL } from '@/lib/logs/rotulos'
import { listarLogs, type NivelLog } from '@/lib/operacao/store'
import { ScrollText } from 'lucide-react'
import Link from 'next/link'

function tom(nivel: NivelLog) {
  if (nivel === 'erro') return 'destructive' as const
  if (nivel === 'alerta') return 'outline' as const
  return 'secondary' as const
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; nivel?: string }>
}) {
  const params = await searchParams
  const busca = (params.busca ?? '').trim().toLowerCase()
  const nivel = params.nivel === 'alerta' || params.nivel === 'erro' || params.nivel === 'info' ? params.nivel : ''
  const logs = [...(await listarLogs())].reverse().filter((item) => {
    if (nivel && item.nivel !== nivel) return false
    if (!busca) return true
    const texto = `${item.mensagem} ${item.evento} ${item.ator ?? ''}`.toLowerCase()
    return texto.includes(busca)
  })

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina titulo="Logs" icone={ScrollText} acoes={<GestaoAtalhos atual="/administracao/logs" />}>
        Acesso, pedidos e decisões da fila. Senha, token e chave não entram no registro.
      </CabecalhoPagina>
      <NotaOperacao />

      <form className="flex flex-wrap items-end gap-2" action="/administracao/logs">
        <Input name="busca" defaultValue={params.busca ?? ''} placeholder="Buscar" className="max-w-xs" />
        <select
          name="nivel"
          defaultValue={nivel}
          className="h-10 rounded-lg border border-input bg-card px-3 text-sm"
        >
          <option value="">Todos</option>
          <option value="info">Info</option>
          <option value="alerta">Alerta</option>
          <option value="erro">Erro</option>
        </select>
        <button type="submit" className={buttonVariants({ size: 'sm' })}>
          Filtrar
        </button>
        <Link href="/administracao/logs" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          Limpar
        </Link>
      </form>

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum evento neste filtro. Entrar, decidir uma entrega ou tratar um pedido grava aqui.
        </p>
      ) : (
        <ul className="grid gap-3">
          {logs.map((item) => (
            <li key={item.id} className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={tom(item.nivel)}>{item.nivel}</Badge>
                <span className="text-xs text-muted-foreground">{dataHoraBR(item.em)}</span>
                <span className="text-xs text-muted-foreground">
                  {EVENTO_LABEL[item.evento] ?? item.evento}
                  {item.ator ? ` · ${item.ator}` : ''}
                </span>
              </div>
              <p className="mt-1 text-sm">{item.mensagem}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
