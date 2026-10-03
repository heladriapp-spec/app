import { criarGrupo } from '@/app/actions/grupos'
import { AcessosNav } from '@/components/acessos-nav'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { GestaoAtalhos } from '@/components/gestao-atalhos'
import { Recado } from '@/components/recado'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { rotuloDiretiva } from '@/lib/acessos/regras'
import { listarGrupos } from '@/lib/operacao/store'
import { Shield, Users } from 'lucide-react'
import Link from 'next/link'

export default async function GruposPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const { erro, ok } = await searchParams
  const grupos = await listarGrupos()

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina
        titulo="Gestão de acessos"
        icone={Shield}
        acoes={<GestaoAtalhos atual="/administracao/grupos" />}
      >
        Grupos, usuários e diretivas. A diretiva fica no grupo. A conta nasce dentro de um grupo que já tenha diretiva.
      </CabecalhoPagina>
      <AcessosNav atual="/administracao/grupos" />
      {ok ? <Recado tom="ok">{ok}</Recado> : null}
      {erro ? <Recado tom="erro">{erro}</Recado> : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Grupos</h2>
        <ul className="grid gap-3">
          {grupos.map((grupo) => (
            <li key={grupo.id}>
              <Link
                href={`/administracao/grupos/${grupo.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm hover:bg-accent"
              >
                <span>
                  <span className="font-medium">{grupo.nome}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {rotuloDiretiva(grupo.diretiva)}
                    {grupo.sistema ? ' · grupo da aplicação' : ''}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  {grupo.membros.length}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Novo grupo</h2>
        <form action={criarGrupo} className="grid max-w-xl gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="grid gap-1">
            <Label htmlFor="grupo-nome">Nome</Label>
            <Input id="grupo-nome" name="nome" required />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="grupo-diretiva">Diretiva</Label>
            <select
              id="grupo-diretiva"
              name="diretiva"
              defaultValue="acesso_comum"
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              <option value="acesso_comum">Acesso comum</option>
              <option value="administrador">Administrador</option>
            </select>
          </div>
          <Button type="submit" className="w-fit">
            Criar grupo
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          O grupo nasce vazio. Na página dele, pesquise um usuário que já existe e inclua. O Executor não recebe diretiva e não se cria de novo.
        </p>
      </section>
    </div>
  )
}
