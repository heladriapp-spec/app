import { sair } from '@/app/actions/auth'
import { AppNavLinks, type NavGroup } from '@/components/app-nav'
import { AppVersao } from '@/components/app-versao'
import { Marca } from '@/components/marca'
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
    <div className="flex min-h-dvh bg-muted/70">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="border-b px-4 py-5">
          <Marca />
          <AppVersao className="mt-3 text-muted-foreground" />
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
        <header className="flex items-center justify-between border-b bg-sidebar px-4 py-3 md:hidden">
          <div>
            <Marca compacta />
            <AppVersao className="mt-1 text-muted-foreground" />
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
        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  )
}
