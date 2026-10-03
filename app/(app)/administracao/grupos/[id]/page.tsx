import { excluirGrupo, mudarMembro } from '@/app/actions/grupos'
import { AcessosNav } from '@/components/acessos-nav'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { Recado } from '@/components/recado'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { rotuloDiretiva } from '@/lib/acessos/regras'
import { listarGrupos, listarUsuariosPublicos } from '@/lib/operacao/store'
import { Shield } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function GrupoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string; ok?: string; q?: string }>
}) {
  const { id } = await params
  const { erro, ok, q } = await searchParams
  const [grupos, usuarios] = await Promise.all([listarGrupos(), listarUsuariosPublicos()])
  const grupo = grupos.find((item) => item.id === id)
  if (!grupo) notFound()
  const termo = (q ?? '').trim().toLowerCase()
  const visiveis = usuarios.filter((usuario) => {
    if (!termo) return true
    return [usuario.nome, usuario.login, usuario.email ?? ''].some((campo) =>
      campo.toLowerCase().includes(termo),
    )
  })
  const podeExcluir = !grupo.sistema && grupo.membros.length === 0

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina titulo={grupo.nome} icone={Shield}>
        {rotuloDiretiva(grupo.diretiva)}
        {grupo.sistema ? '. Este grupo faz parte da aplicação e não se apaga.' : '. Grupo vazio pode ser excluído.'}
      </CabecalhoPagina>
      <AcessosNav atual="/administracao/grupos" />
      <Link href="/administracao/grupos" className="text-sm underline">
        Voltar aos grupos
      </Link>
      {ok ? <Recado tom="ok">{ok}</Recado> : null}
      {erro ? <Recado tom="erro">{erro}</Recado> : null}

      <form method="get" className="flex max-w-xl items-end gap-2">
        <div className="grid flex-1 gap-1">
          <Label htmlFor="busca-usuario">Pesquisar usuário</Label>
          <Input id="busca-usuario" name="q" defaultValue={q ?? ''} placeholder="Nome, login ou e-mail" />
        </div>
        <Button type="submit" variant="outline">
          Pesquisar
        </Button>
      </form>

      <ul className="grid gap-2">
        {visiveis.map((usuario) => {
          const dentro = grupo.membros.includes(usuario.id)
          return (
            <li
              key={usuario.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3"
            >
              <span>
                <span className="font-medium">{usuario.nome}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {usuario.login}
                  {usuario.email ? ` · ${usuario.email}` : ''}
                </span>
              </span>
              <form action={mudarMembro}>
                <input type="hidden" name="grupoId" value={grupo.id} />
                <input type="hidden" name="usuarioId" value={usuario.id} />
                <input type="hidden" name="incluir" value={dentro ? 'nao' : 'sim'} />
                <input type="hidden" name="q" value={q ?? ''} />
                <Button type="submit" size="sm" variant={dentro ? 'outline' : 'default'}>
                  {dentro ? 'Tirar' : 'Incluir'}
                </Button>
              </form>
            </li>
          )
        })}
      </ul>
      {visiveis.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum usuário com esse texto.</p> : null}

      {podeExcluir ? (
        <form action={excluirGrupo}>
          <input type="hidden" name="id" value={grupo.id} />
          <Button type="submit" variant="destructive" size="sm">
            Excluir grupo
          </Button>
        </form>
      ) : null}
    </div>
  )
}
