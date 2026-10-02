import { pedirAcesso } from '@/app/actions/auth'
import { AuthShell } from '@/components/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

export default async function PedirAcessoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const { erro, ok } = await searchParams

  return (
    <AuthShell titulo="Pedir acesso">
      <p className="text-sm text-muted-foreground">
        Nome, e-mail e celular. Usuário e senha entram no link de confirmação, depois que o
        administrador aprovar. Até lá o pedido fica pendente.
      </p>
      {ok ? (
        <p className="rounded-lg border px-3 py-2 text-sm">
          Pedido enviado. Ele aparece só para o administrador.
        </p>
      ) : null}
      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
      <form action={pedirAcesso} className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" name="nome" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="celular">Celular</Label>
          <Input id="celular" name="celular" required />
        </div>
        <Button type="submit">Enviar pedido</Button>
      </form>
      <Link href="/login" className="text-sm underline">
        Voltar ao login
      </Link>
    </AuthShell>
  )
}
