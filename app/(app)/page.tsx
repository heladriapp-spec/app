import { assumirProjeto } from '@/app/actions/projetos'
import { BoasVindas } from '@/components/boas-vindas'
import { LinkProjeto } from '@/components/link-projeto'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { Recado } from '@/components/recado'
import { RemoverProjeto } from '@/components/remover-projeto'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { COOKIE_RECADO } from '@/lib/auth/sessao'
import { requireUser } from '@/lib/auth/guard'
import { dataHoraBR } from '@/lib/formato'
import { dataProjetoBR } from '@/lib/planilha/numeros'
import { pode } from '@/lib/projetos/acesso'
import { listarExecucaoDoResponsavel, listarFilaExecucao, listarProjetos } from '@/lib/projetos/store'
import { STATUS_PROJETO, type ProjetoLista } from '@/lib/projetos/tipos'
import { FileSpreadsheet, FolderKanban, Plus } from 'lucide-react'
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
  const projetos = await listarProjetos(usuario)
  const fila = usuario.executor ? await listarFilaExecucao() : []
  const meus = usuario.executor ? await listarExecucaoDoResponsavel(usuario.id) : []

  return (
    <div className="flex flex-col gap-8">
      {recado ? <BoasVindas nome={usuario.nome} /> : null}
      <CabecalhoPagina
        titulo="Projetos"
        icone={FolderKanban}
        acoes={
          <Link href="/projetos/novo" className={buttonVariants()}>
            <Plus data-icon="inline-start" />
            Criar novo projeto
          </Link>
        }
      >
        {usuario.papel === 'administrador'
          ? 'Cada trabalho do SESC é um projeto, com a planilha daquele trabalho.'
          : `${usuario.nome}, estes são os projetos que você criou.`}
      </CabecalhoPagina>
      {avisos.erro ? <Recado tom="erro">{avisos.erro}</Recado> : null}
      {avisos.ok ? <Recado tom="ok">{avisos.ok}</Recado> : null}
      {usuario.executor ? <FilaExecucao fila={fila} meus={meus} /> : null}
      {projetos.length === 0 ? (
        <p className="rounded-2xl border bg-card px-5 py-10 text-sm text-muted-foreground shadow-sm">
          {usuario.papel === 'administrador'
            ? 'Nenhum projeto ainda. Crie o primeiro com a planilha do SESC.'
            : 'Nenhum projeto seu ainda. Crie o primeiro com a planilha do SESC.'}
        </p>
      ) : (
        <ul className="grid gap-3">
          {projetos.map((projeto) => {
            const podeRemover = pode(usuario, alvoDaLista(projeto), 'excluir')
            const confirmando = podeRemover && avisos.confirmar === projeto.id
            return (
              <li key={projeto.id} className="rounded-2xl border bg-card shadow-sm">
                <div className="flex items-center gap-4 px-4 py-4">
                  <LinkProjeto
                    href={`/projetos/${projeto.id}`}
                    className="flex min-w-0 flex-1 items-center gap-4"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FileSpreadsheet className="size-5" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{projeto.nome}</span>
                        <Badge variant={projeto.status === 'em_execucao' ? 'default' : 'secondary'}>
                          {STATUS_PROJETO[projeto.status]}
                        </Badge>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {dataProjetoBR(projeto.data)}
                        {projeto.arquivoNome ? ` · ${projeto.arquivoNome}` : ''} · {textoAlteracao(projeto)}
                      </span>
                    </span>
                  </LinkProjeto>
                  {podeRemover && !confirmando ? (
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

function alvoDaLista(projeto: ProjetoLista) {
  return {
    criadoPor: projeto.criadoPor,
    participantes: [],
    status: projeto.status,
    arquivoNome: projeto.arquivoNome,
    arquivoGeradoNome: null,
    responsavelId: null,
  }
}

function FilaExecucao({ fila, meus }: { fila: ProjetoLista[]; meus: ProjetoLista[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Fila de execução</h2>
      <p className="text-sm text-muted-foreground">
        Projetos enviados, ainda sem responsável. Assumir deixa a edição e a conclusão com você.
      </p>
      {fila.length === 0 ? (
        <p className="rounded-2xl border bg-card px-5 py-6 text-sm text-muted-foreground shadow-sm">
          Nenhum projeto aguardando responsável.
        </p>
      ) : (
        <ul className="grid gap-3">
          {fila.map((projeto) => (
            <li key={projeto.id} className="flex items-center gap-4 rounded-2xl border bg-card px-4 py-4 shadow-sm">
              <LinkProjeto href={`/projetos/${projeto.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileSpreadsheet className="size-5" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium">{projeto.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {dataProjetoBR(projeto.data)} · aguardando responsável
                  </span>
                </span>
              </LinkProjeto>
              <form action={assumirProjeto}>
                <input type="hidden" name="id" value={projeto.id} />
                <Button type="submit" size="sm">
                  Assumir
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {meus.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Com você</h3>
          <ul className="grid gap-3">
            {meus.map((projeto) => (
              <li key={projeto.id}>
                <LinkProjeto
                  href={`/projetos/${projeto.id}`}
                  className="flex items-center gap-4 rounded-2xl border bg-card px-4 py-4 shadow-sm"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileSpreadsheet className="size-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{projeto.nome}</span>
                      <Badge>Em execução</Badge>
                    </span>
                    <span className="text-xs text-muted-foreground">Você edita e conclui este projeto.</span>
                  </span>
                </LinkProjeto>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function textoAlteracao(projeto: ProjetoLista) {
  return `última alteração ${dataHoraBR(projeto.atualizadoEm)} por ${projeto.atualizadoPor}`
}
