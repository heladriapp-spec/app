import { BoasVindas } from '@/components/boas-vindas'
import { RemoverProjeto } from '@/components/remover-projeto'
import { buttonVariants } from '@/components/ui/button'
import { COOKIE_RECADO } from '@/lib/auth/sessao'
import { requireUser } from '@/lib/auth/guard'
import { dataHoraBR } from '@/lib/formato'
import { dataProjetoBR } from '@/lib/planilha/numeros'
import { listarProjetos } from '@/lib/projetos/store'
import { STATUS_PROJETO, type Projeto } from '@/lib/projetos/tipos'
import { FileSpreadsheet, Plus, Trash2 } from 'lucide-react'
import { cookies } from 'next/headers'
import Link from 'next/link'

export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmar?: string; erro?: string; ok?: string }>
}) {
  const usuario = await requireUser()
  const recado = (await cookies()).get(COOKIE_RECADO)?.value === '1' && !usuario.ocultarBoasVindas
  const avisos = await searchParams
  const todos = await listarProjetos()
  const projetos =
    usuario.papel === 'administrador'
      ? todos
      : todos.filter((item) => item.participantes.includes(usuario.id))

  return (
    <div className="flex flex-col gap-6">
      {recado ? <BoasVindas nome={usuario.nome} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Projetos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {usuario.papel === 'administrador'
              ? 'Cada trabalho do SESC é um projeto, com a planilha daquele trabalho.'
              : `${usuario.nome}, estes são os projetos em que você está incluído.`}
          </p>
        </div>
        {usuario.papel === 'administrador' ? (
          <Link href="/projetos/novo" className={buttonVariants()}>
            <Plus data-icon="inline-start" />
            Criar novo projeto
          </Link>
        ) : null}
      </div>
      {avisos.erro ? (
        <p className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {avisos.erro}
        </p>
      ) : null}
      {avisos.ok ? <p className="rounded-lg border px-3 py-2 text-sm">{avisos.ok}</p> : null}
      {projetos.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-8 text-sm text-muted-foreground">
          {usuario.papel === 'administrador'
            ? 'Nenhum projeto ainda. Crie o primeiro e, se quiser, carregue a planilha do SESC.'
            : 'Nenhum projeto em que você atua.'}
        </p>
      ) : (
        <ul className="grid gap-2">
          {projetos.map((projeto) => {
            const confirmando =
              usuario.papel === 'administrador' && avisos.confirmar === projeto.id
            return (
              <li key={projeto.id} className="rounded-xl border bg-card">
                <div className="flex items-center gap-3 px-3 py-3">
                  <Link
                    href={`/projetos/${projeto.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium">{projeto.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {dataProjetoBR(projeto.data)} · {STATUS_PROJETO[projeto.status]}
                        {projeto.arquivoNome ? ` · ${projeto.arquivoNome}` : ''} · {textoAlteracao(projeto)}
                      </span>
                    </span>
                  </Link>
                  {usuario.papel === 'administrador' && !confirmando ? (
                    <RemoverProjeto
                      id={projeto.id}
                      nome={projeto.nome}
                      confirmar={false}
                      destinoConfirmar={`/?confirmar=${projeto.id}`}
                      destinoCancelar="/"
                    />
                  ) : null}
                </div>
                {confirmando ? (
                  <div className="border-t bg-destructive/5 px-3 py-3">
                    <RemoverProjeto
                      id={projeto.id}
                      nome={projeto.nome}
                      confirmar
                      destinoConfirmar={`/?confirmar=${projeto.id}`}
                      destinoCancelar="/"
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function textoAlteracao(projeto: Projeto) {
  return `última alteração ${dataHoraBR(projeto.atualizadoEm)} por ${projeto.atualizadoPor}`
}
