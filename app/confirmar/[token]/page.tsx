import { confirmarAcesso } from '@/app/actions/auth'
import { AuthShell } from '@/components/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { acharLink, motivoDoLink, tokenInformado } from '@/lib/auth/links'
import { lerStore } from '@/lib/operacao/store'
import Link from 'next/link'

export default async function ConfirmarPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ erro?: string }>
}) {
  const { token: bruto } = await params
  const { erro } = await searchParams
  const token = tokenInformado(bruto)
  const store = await lerStore()
  const link = token ? acharLink(store.links, token) : null
  const motivo = motivoDoLink(link, 'confirmacao')
  const pedido = link ? store.pedidos.find((item) => item.id === link.pedidoId) : null
  const invalido = motivo ?? (pedido?.situacao === 'aprovado' ? null : 'Este link não vale.')

  return (
    <AuthShell titulo="Confirmar acesso">
      {invalido ? (
        <p className="text-sm text-destructive">{invalido}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {pedido?.nome}, escolha o usuário e a senha. O link vale uma vez. A conta entra como usuário comum.
          </p>
          {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
          <form action={confirmarAcesso} className="grid gap-3">
            <input type="hidden" name="token" value={token ?? ''} />
            <div className="grid gap-1.5">
              <Label htmlFor="login">Usuário</Label>
              <Input id="login" name="login" autoComplete="username" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input id="senha" name="senha" type="password" autoComplete="new-password" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="senha2">Repetir senha</Label>
              <Input id="senha2" name="senha2" type="password" autoComplete="new-password" required />
            </div>
            <Button type="submit">Confirmar e entrar</Button>
          </form>
        </>
      )}
      <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
        Voltar ao login
      </Link>
    </AuthShell>
  )
}
