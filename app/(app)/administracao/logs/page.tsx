import { GestaoAtalhos } from '@/components/gestao-atalhos'
import { NotaOperacao } from '@/components/nota-operacao'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { dataHoraBR } from '@/lib/formato'
import { EVENTO_LABEL } from '@/lib/logs/rotulos'
import { lerStore, type NivelLog } from '@/lib/operacao/store'
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
  const store = await lerStore()
  const logs = [...store.logs].reverse().filter((item) => {
    if (nivel && item.nivel !== nivel) return false
    if (!busca) return true
    const texto = `${item.mensagem} ${item.evento} ${item.ator ?? ''}`.toLowerCase()
    return texto.includes(busca)
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold md:text-xl">
            <ScrollText className="size-5 text-muted-foreground" />
            Logs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesso, pedidos e decisões da fila. Senha, token e chave não entram no registro.
          </p>
        </div>
        <GestaoAtalhos atual="/administracao/logs" />
      </div>
      <NotaOperacao />

      <form className="flex flex-wrap items-end gap-2" action="/administracao/logs">
        <Input name="busca" defaultValue={params.busca ?? ''} placeholder="Buscar" className="max-w-xs" />
        <select
          name="nivel"
          defaultValue={nivel}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
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
        <ul className="grid gap-2">
          {logs.map((item) => (
            <li key={item.id} className="rounded-lg border bg-card px-3 py-2">
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
