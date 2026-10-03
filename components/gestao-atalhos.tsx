import { buttonVariants } from '@/components/ui/button'
import { HeartPulse, Rocket, ScrollText, Shield, Workflow } from 'lucide-react'
import Link from 'next/link'

const ITENS = [
  { href: '/administracao', label: 'Gestão de acessos', icon: Shield },
  { href: '/administracao/implementacoes', label: 'Implantações', icon: Rocket },
  { href: '/administracao/esteira', label: 'Esteira', icon: Workflow },
  { href: '/administracao/logs', label: 'Logs', icon: ScrollText },
  { href: '/administracao/saude', label: 'Saúde', icon: HeartPulse },
]

export function GestaoAtalhos({ atual }: { atual: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ITENS.filter((item) => item.href !== atual).map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href === '/administracao/implementacoes' ? `${item.href}?visao=releases` : item.href}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Icon data-icon="inline-start" />
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
