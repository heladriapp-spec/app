import { AppChrome } from '@/components/app-chrome'
import type { NavGroup } from '@/components/app-nav'
import { requireUser } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

const trabalho: NavGroup = {
  label: 'Trabalho',
  items: [{ href: '/', label: 'Início', id: 'inicio' }],
}

const operacao: NavGroup = {
  label: 'Operação',
  items: [
    { href: '/administracao', label: 'Administração', id: 'administracao' },
    { href: '/administracao/implementacoes', label: 'Implantações', id: 'implementacoes' },
    { href: '/administracao/esteira', label: 'Esteira', id: 'esteira' },
    { href: '/administracao/logs', label: 'Logs', id: 'logs' },
    { href: '/administracao/saude', label: 'Saúde', id: 'saude' },
  ],
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUser()
  const groups = usuario.papel === 'administrador' ? [trabalho, operacao] : [trabalho]
  return (
    <AppChrome usuario={usuario} groups={groups}>
      {children}
    </AppChrome>
  )
}
