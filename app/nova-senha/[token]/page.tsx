import { definirSenhaNova } from '@/app/actions/auth'
import { AuthShell } from '@/components/auth-shell'
import { CampoSenha } from '@/components/campo-senha'
import { Button } from '@/components/ui/button'
import { motivoDoLink, tokenInformado } from '@/lib/auth/links'
import { partirNome } from '@/lib/auth/politica-senha'
import { buscarLinkPorToken, buscarUsuarioPublicoPorId } from '@/lib/operacao/store'
import Link from 'next/link'

export default async function NovaSenhaPage({
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
  const motivo = motivoDoLink(link, 'senha')
  const usuario = link?.usuarioId ? await buscarUsuarioPublicoPorId(link.usuarioId) : null
  const nomes = partirNome(usuario?.nome ?? '')

  return (
    <AuthShell titulo="Senha nova">
      {motivo ? (
        <p className="text-sm text-destructive">{motivo}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Defina a senha nova. O link vale uma vez. A senha atual não veio no e-mail.
          </p>
          {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
          <form action={definirSenhaNova} className="grid gap-3">
            <input type="hidden" name="token" value={token ?? ''} />
            <CampoSenha
              pessoa={{
                primeiroNome: usuario?.primeiroNome || nomes.primeiroNome,
                sobrenome: usuario?.sobrenome || nomes.sobrenome,
                email: usuario?.email ?? link?.email ?? '',
              }}
            />
            <Button type="submit">Gravar senha</Button>
          </form>
        </>
      )}
      <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
        Voltar ao login
      </Link>
    </AuthShell>
  )
}
