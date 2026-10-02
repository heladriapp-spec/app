import { removerProjeto } from '@/app/actions/projetos'
import { Button, buttonVariants } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import Link from 'next/link'

export function RemoverProjeto({
  id,
  nome,
  confirmar,
  destinoConfirmar,
  destinoCancelar,
}: {
  id: string
  nome: string
  confirmar: boolean
  destinoConfirmar: string
  destinoCancelar: string
}) {
  if (!confirmar) {
    return (
      <Link href={destinoConfirmar} className={buttonVariants({ variant: 'destructive', size: 'sm' })}>
        <Trash2 data-icon="inline-start" />
        Remover
      </Link>
    )
  }

  return (
    <form action={removerProjeto} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm">{`Remover “${nome}”? A planilha e o que já foi preenchido saem da lista.`}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive">
          Remover projeto
        </Button>
        <Link href={destinoCancelar} className={buttonVariants({ variant: 'outline' })}>
          Cancelar
        </Link>
      </div>
    </form>
  )
}
