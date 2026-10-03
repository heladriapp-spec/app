import { AcessosNav } from '@/components/acessos-nav'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { rotuloDiretiva, type DiretivaGrupo } from '@/lib/acessos/regras'
import { listarGrupos } from '@/lib/operacao/store'
import { Shield } from 'lucide-react'
import Link from 'next/link'

const DIRETIVAS: Array<{ id: DiretivaGrupo; texto: string }> = [
  {
    id: 'administrador',
    texto: 'Acesso a tudo, inclusive a gestão de acessos.',
  },
  {
    id: 'acesso_comum',
    texto: 'Lança nos projetos em que está. Não cria projeto, não apaga linha, não abre a gestão de acessos e não inclui participante.',
  },
]

export default async function DiretivasPage() {
  const grupos = await listarGrupos()

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina titulo="Gestão de acessos" icone={Shield}>
        As diretivas nascem com a aplicação. Não se cria diretiva nova. O grupo escolhe uma delas.
      </CabecalhoPagina>
      <AcessosNav atual="/administracao/diretivas" />
      <ul className="grid gap-3">
        {DIRETIVAS.map((diretiva) => {
          const usos = grupos.filter((grupo) => grupo.diretiva === diretiva.id)
          return (
            <li key={diretiva.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <h2 className="font-medium">{rotuloDiretiva(diretiva.id)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{diretiva.texto}</p>
              <p className="mt-3 text-sm">
                {usos.length === 0
                  ? 'Nenhum grupo usa esta diretiva.'
                  : usos.map((grupo, indice) => (
                      <span key={grupo.id}>
                        {indice > 0 ? ', ' : ''}
                        <Link href={`/administracao/grupos/${grupo.id}`} className="underline">
                          {grupo.nome}
                        </Link>
                      </span>
                    ))}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
