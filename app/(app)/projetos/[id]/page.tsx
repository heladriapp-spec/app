import { carregarPlanilha } from '@/app/actions/projetos'
import { FormPlanilha } from '@/components/form-planilha'
import { ArquivoReferencial } from '@/components/arquivo-referencial'
import { CotacaoTela } from '@/components/cotacao-tela'
import { RemoverProjeto } from '@/components/remover-projeto'
import { PlanilhaTela } from '@/components/planilha-tela'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requireUser } from '@/lib/auth/guard'
import { dataHoraBR } from '@/lib/formato'
import { dataProjetoBR } from '@/lib/planilha/numeros'
import { planilhaDoProjeto, projetoPorId, valoresDaCotacao } from '@/lib/projetos/store'
import { STATUS_PROJETO } from '@/lib/projetos/tipos'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

export default async function ProjetoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string; ok?: string; confirmar?: string }>
}) {
  const usuario = await requireUser()
  const { id } = await params
  const avisos = await searchParams
  const projeto = await projetoPorId(id)
  if (!projeto) notFound()
  const participa =
    usuario.papel === 'administrador' || projeto.participantes.includes(usuario.id)
  if (!participa) redirect('/')

  const lida = await planilhaDoProjeto(projeto).catch(() => null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/" className="underline">
              Projetos
            </Link>
          </p>
          <h1 className="mt-1 text-xl font-semibold">{projeto.nome}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dataProjetoBR(projeto.data)} · {STATUS_PROJETO[projeto.status]} · última alteração{' '}
            {dataHoraBR(projeto.atualizadoEm)} por {projeto.atualizadoPor}
          </p>
        </div>
        {usuario.papel === 'administrador' && avisos.confirmar !== 'remover' ? (
          <RemoverProjeto
            id={projeto.id}
            nome={projeto.nome}
            confirmar={false}
            destinoConfirmar={`/projetos/${projeto.id}?confirmar=remover`}
            destinoCancelar={`/projetos/${projeto.id}`}
          />
        ) : null}
      </div>
      {usuario.papel === 'administrador' && avisos.confirmar === 'remover' ? (
        <div className="rounded-lg border border-destructive/40 px-3 py-3">
          <RemoverProjeto
            id={projeto.id}
            nome={projeto.nome}
            confirmar
            destinoConfirmar={`/projetos/${projeto.id}?confirmar=remover`}
            destinoCancelar={`/projetos/${projeto.id}`}
          />
        </div>
      ) : null}
      {avisos.erro ? (
        <p className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {avisos.erro}
        </p>
      ) : null}
      {avisos.ok ? (
        <p className="rounded-lg border px-3 py-2 text-sm">{avisos.ok}</p>
      ) : null}
      {lida?.formato === 'cotacao' && lida.cotacao ? (
        <div className="flex flex-col gap-3">
          <ArquivoReferencial projeto={projeto} />
          <p className="text-sm text-muted-foreground">
            {lida.cotacao.subtitulo || lida.cotacao.titulo}
          </p>
          <CotacaoTela
            projetoId={projeto.id}
            arquivoNome={projeto.arquivoNome}
            cotacao={lida.cotacao}
            iniciais={valoresDaCotacao(projeto, lida.cotacao)}
          />
        </div>
      ) : lida ? (
        <div className="flex flex-col gap-3">
          <ArquivoReferencial projeto={projeto} />
          <p className="text-sm text-muted-foreground">
            {lida.capa.aba}
            {lida.capa.processo ? ` · ${lida.capa.processo}` : ''}
            {lida.capa.evento ? ` · ${lida.capa.evento}` : ''}
            {lida.capa.unidade ? ` · ${lida.capa.unidade}` : ''}
          </p>
          <PlanilhaTela projeto={projeto} linhas={lida.linhas} />
        </div>
      ) : (
        <div className="max-w-lg rounded-lg border p-4">
          <h2 className="text-sm font-medium">Planilha referencial</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {projeto.status === 'rascunho'
              ? 'Este projeto está em rascunho. A planilha que você carregar fica amarrada a ele e abre o preenchimento.'
              : 'Este projeto ainda não tem arquivo. A tela de preenchimento abre quando a planilha for carregada.'}
          </p>
          {usuario.papel === 'administrador' ? (
            <FormPlanilha action={carregarPlanilha} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={projeto.id} />
              <div className="grid gap-1.5">
                <Label htmlFor="arquivo">Arquivo .xlsx</Label>
                <Input
                  id="arquivo"
                  name="arquivo"
                  type="file"
                  required
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                />
              </div>
              <Button type="submit">Carregar planilha</Button>
            </FormPlanilha>
          ) : null}
        </div>
      )}
    </div>
  )
}
