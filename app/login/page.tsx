import { entrar } from '@/app/actions/auth'
import { AuthShell } from '@/components/auth-shell'
import { usuarioDaSessao } from '@/lib/auth/guard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LogIn } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  if (await usuarioDaSessao()) redirect('/')
  const { erro, ok } = await searchParams

  return (
    <AuthShell titulo="Entrar">
      <p className="text-sm text-muted-foreground">
        A operação (usuários, versão, esteira, logs e saúde) fica com o administrador. O
        lançamento na planilha fica com quem ele incluir.
      </p>
      {ok ? <p className="rounded-lg border px-3 py-2 text-sm">{ok}</p> : null}
      {erro ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive"
        >
          {erro}
        </p>
      ) : null}
      <form action={entrar} className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="login">Usuário</Label>
          <Input id="login" name="login" autoComplete="username" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="senha">Senha</Label>
          <Input id="senha" name="senha" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit">
          <LogIn data-icon="inline-start" />
          Entrar
        </Button>
      </form>
      <p className="flex gap-4 text-sm">
        <Link href="/pedir-acesso" className="text-muted-foreground hover:text-foreground">
          Pedir acesso
        </Link>
        <Link href="/esqueci-senha" className="text-muted-foreground hover:text-foreground">
          Esqueci a senha
        </Link>
      </p>
      <p className="text-xs text-muted-foreground">
        Contas da instalação: adm e convidado. As duas não têm e-mail.
      </p>
    </AuthShell>
  )
}
