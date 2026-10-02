import { criarProjeto } from '@/app/actions/projetos'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormPlanilha } from '@/components/form-planilha'
import { Recado } from '@/components/recado'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requireAdmin } from '@/lib/auth/guard'
import { dataHojeISO } from '@/lib/planilha/numeros'
import { FolderPlus, Plus, Save } from 'lucide-react'
import Link from 'next/link'

export default async function NovoProjetoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  await requireAdmin()
  const { erro } = await searchParams

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
      <CabecalhoPagina titulo="Criar novo projeto" icone={FolderPlus}>
        Nome e data identificam o trabalho. A planilha do SESC, se entrar agora, fica amarrada a
        este projeto como arquivo referencial. Dá para salvar em rascunho e concluir depois. O
        memorial descritivo é outro documento e não entra neste formulário.
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
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          />
          <p className="text-xs text-muted-foreground">
            Opcional, até 4 MB. O arquivo .xlsx fica guardado com o projeto e é a base da planilha
            gerada na conclusão.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="acao" value="rascunho" variant="outline">
            <Save data-icon="inline-start" />
            Salvar rascunho
          </Button>
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
