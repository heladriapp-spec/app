import { criarProjeto } from '@/app/actions/projetos'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormPlanilha } from '@/components/form-planilha'
import { Recado } from '@/components/recado'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requireUser } from '@/lib/auth/guard'
import { dataHojeISO } from '@/lib/planilha/numeros'
import { FolderPlus, Plus } from 'lucide-react'
import Link from 'next/link'

export default async function NovoProjetoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  await requireUser()
  const { erro } = await searchParams

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
      <CabecalhoPagina titulo="Criar novo projeto" icone={FolderPlus}>
        Nome e data identificam o trabalho. A planilha do SESC entra agora e fica amarrada a este
        projeto. O memorial descritivo é outro documento e não entra neste formulário.
      </CabecalhoPagina>
      {erro ? <Recado tom="erro">{erro}</Recado> : null}
      <FormPlanilha action={criarProjeto} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" name="nome" required maxLength={120} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="data">Data</Label>
          <Input id="data" name="data" type="date" required defaultValue={dataHojeISO()} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="arquivo">Planilha referencial</Label>
          <Input
            id="arquivo"
            name="arquivo"
            type="file"
            required
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          />
          <p className="text-xs text-muted-foreground">
            Obrigatória, até 4 MB. O arquivo .xlsx fica guardado com o projeto. Se a leitura falhar,
            o projeto não é criado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="acao" value="criar">
            <Plus data-icon="inline-start" />
            Criar projeto
          </Button>
          <Link href="/" className={buttonVariants({ variant: 'ghost' })}>
            Cancelar
          </Link>
        </div>
      </FormPlanilha>
    </div>
  )
}
