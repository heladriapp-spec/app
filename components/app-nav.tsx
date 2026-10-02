'use client'

import { cn } from '@/lib/utils'
import { HeartPulse, LayoutDashboard, Rocket, ScrollText, Shield, Workflow } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const navIcons = {
  inicio: LayoutDashboard,
  administracao: Shield,
  implementacoes: Rocket,
  esteira: Workflow,
  logs: ScrollText,
  saude: HeartPulse,
}

export type NavLink = {
  href: string
  label: string
  id: keyof typeof navIcons
}

export type NavGroup = {
  label: string
  items: NavLink[]
}

function ativo(pathname: string, href: string, hrefs: string[]) {
  if (href === '/') return pathname === '/'
  if (pathname === href) return true
  if (!pathname.startsWith(`${href}/`)) return false
  return !hrefs.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  )
}

export function AppNavLinks({
  groups,
  tom = 'escuro',
}: {
  groups: NavGroup[]
  tom?: 'escuro' | 'claro'
}) {
  const pathname = usePathname()
  const hrefs = groups.flatMap((group) => group.items.map((item) => item.href))

  return (
    <nav className="flex flex-col gap-6" aria-label="Seções">
      {groups.map((group) => (
        <div key={group.label} className="grid gap-1">
          <p
            className={cn(
              'px-2.5 text-[0.65rem] font-semibold tracking-[0.16em] uppercase',
              tom === 'escuro' ? 'text-slate-500' : 'text-muted-foreground',
            )}
          >
            {group.label}
          </p>
          <div className="grid gap-0.5">
            {group.items.map((link) => {
              const Icon = navIcons[link.id]
              const ligado = ativo(pathname, link.href, hrefs)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={ligado ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium',
                    tom === 'escuro'
                      ? ligado
                        ? 'bg-white/10 text-white'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      : ligado
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className="size-4 opacity-80" />
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
