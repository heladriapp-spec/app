import { esqueciSenha } from '@/app/actions/auth'
import { AuthShell } from '@/components/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

export default async function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const { erro, ok } = await searchParams

  return (
    <AuthShell titulo="Esqueci a senha">
      <p className="text-sm text-muted-foreground">
        O link de uso único sai quando o remetente de e-mail estiver na esteira. A senha atual
        não é enviada. Contas da instalação, sem e-mail, não usam este caminho.
      </p>
      {ok ? (
        <p className="rounded-lg border px-3 py-2 text-sm">
          Se a conta tiver e-mail, o link será enviado nessa entrega. Nada foi enviado agora.
        </p>
      ) : null}
      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
      <form action={esqueciSenha} className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="email">E-mail da conta</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <Button type="submit">Pedir link</Button>
      </form>
      <Link href="/login" className="text-sm underline">
        Voltar ao login
      </Link>
    </AuthShell>
  )
}
