import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const ITENS = [
  { href: '/administracao/grupos', label: 'Grupos' },
  { href: '/administracao', label: 'Usuários' },
  { href: '/administracao/diretivas', label: 'Diretivas' },
]

export function AcessosNav({ atual }: { atual: string }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Gestão de acessos">
      {ITENS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.href === atual ? 'page' : undefined}
          className={cn(buttonVariants({ size: 'sm', variant: item.href === atual ? 'default' : 'outline' }))}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
