import { sair } from '@/app/actions/auth'
import { AppNavLinks, type NavGroup } from '@/components/app-nav'
import { AppVersao } from '@/components/app-versao'
import { Button } from '@/components/ui/button'
import type { UsuarioPublico } from '@/lib/operacao/store'
import { LogOut } from 'lucide-react'
import type { ReactNode } from 'react'

const PAPEL = { administrador: 'Administrador', comum: 'Usuário comum' }

export function AppChrome({
  usuario,
  groups,
  children,
}: {
  usuario: UsuarioPublico
  groups: NavGroup[]
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh bg-muted/50">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="px-4 pt-5 pb-4">
          <p className="text-sm font-semibold">Heladri</p>
          <p className="text-xs text-muted-foreground">Planilha do SESC</p>
          <AppVersao className="mt-1 text-muted-foreground" />
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <AppNavLinks groups={groups} tom="claro" />
        </div>
        <div className="border-t px-4 py-3">
          <p className="truncate text-sm" title={usuario.login}>
            {usuario.nome}
          </p>
          <p className="text-xs text-muted-foreground">{PAPEL[usuario.papel]}</p>
          <form action={sair} data-aviso="sair" className="mt-2">
            <Button type="submit" variant="ghost" size="sm">
              <LogOut data-icon="inline-start" />
              Sair
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
          <div>
            <p className="text-sm font-semibold">Heladri</p>
            <AppVersao className="text-muted-foreground" />
          </div>
          <form action={sair} data-aviso="sair">
            <Button type="submit" variant="ghost" size="sm">
              <LogOut data-icon="inline-start" />
              Sair
            </Button>
          </form>
        </header>
        <div className="border-b px-4 py-3 md:hidden">
          <AppNavLinks groups={groups} tom="claro" />
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}
