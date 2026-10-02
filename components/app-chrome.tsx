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
    <div className="flex min-h-dvh bg-background">
      <aside className="campo-heladri filete-heladri sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/10 text-sidebar-foreground md:flex">
        <div className="border-b border-white/10 px-4 py-5">
          <Marca />
          <AppVersao className="mt-3 text-white/45" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <AppNavLinks groups={groups} tom="escuro" />
        </div>
        <div className="border-t border-white/10 px-4 py-3">
          <p className="truncate text-sm" title={usuario.login}>
            {usuario.nome}
          </p>
          <p className="text-xs text-white/50">{PAPEL[usuario.papel]}</p>
          <form action={sair} data-aviso="sair" className="mt-2">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-white/80 hover:bg-white/10 hover:text-white"
            >
              <LogOut data-icon="inline-start" />
              Sair
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="campo-heladri filete-heladri flex items-center justify-between px-4 py-3 text-white md:hidden">
          <div>
            <Marca compacta />
            <AppVersao className="mt-1.5 text-white/45" />
          </div>
          <form action={sair} data-aviso="sair">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-white/80 hover:bg-white/10 hover:text-white"
            >
              <LogOut data-icon="inline-start" />
              Sair
            </Button>
          </form>
        </header>
        <div className="border-b px-4 py-3 md:hidden">
          <AppNavLinks groups={groups} tom="claro" />
        </div>
        <main className="w-full flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  )
}
