import { confirmarAcesso } from '@/app/actions/auth'
import { AuthShell } from '@/components/auth-shell'
import { CampoSenha } from '@/components/campo-senha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { motivoDoLink, tokenInformado } from '@/lib/auth/links'
import { partirNome } from '@/lib/auth/politica-senha'
import { buscarLinkPorToken, buscarPedidoPorId } from '@/lib/operacao/store'
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
  const link = token ? await buscarLinkPorToken(token) : null
  const motivo = motivoDoLink(link, 'confirmacao')
  const pedido = link?.pedidoId ? await buscarPedidoPorId(link.pedidoId) : null
  const invalido = motivo ?? (pedido?.situacao === 'aprovado' ? null : 'Este link não vale.')

  return (
    <AuthShell titulo="Confirmar acesso">
      {invalido ? (
        <p className="text-sm text-destructive">{invalido}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {pedido?.nome}, defina a senha. O e-mail já é o login. O link vale uma vez.
          </p>
          {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
          <form action={confirmarAcesso} className="grid gap-3">
            <input type="hidden" name="token" value={token ?? ''} />
            <div className="grid gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={link?.email ?? ''} disabled />
            </div>
            <CampoSenha
              pessoa={{
                primeiroNome: pedido?.primeiroNome || partirNome(pedido?.nome ?? '').primeiroNome,
                sobrenome: pedido?.sobrenome || partirNome(pedido?.nome ?? '').sobrenome,
                email: link?.email ?? '',
              }}
            />
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
