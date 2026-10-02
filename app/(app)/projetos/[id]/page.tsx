import { carregarPlanilha } from '@/app/actions/projetos'
import { FormPlanilha } from '@/components/form-planilha'
import { ArquivoReferencial } from '@/components/arquivo-referencial'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { CotacaoTela } from '@/components/cotacao-tela'
import { Recado } from '@/components/recado'
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
import { ArrowLeft, FileSpreadsheet } from 'lucide-react'
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-3.5" />
            Projetos
          </Link>
        </p>
        <CabecalhoPagina
          titulo={projeto.nome}
          icone={FileSpreadsheet}
          acoes={
            usuario.papel === 'administrador' && avisos.confirmar !== 'remover' ? (
              <RemoverProjeto
                id={projeto.id}
                nome={projeto.nome}
                confirmar={false}
                destinoConfirmar={`/projetos/${projeto.id}?confirmar=remover`}
                destinoCancelar={`/projetos/${projeto.id}`}
              />
            ) : null
          }
        >
          {dataProjetoBR(projeto.data)} · {STATUS_PROJETO[projeto.status]} · última alteração{' '}
          {dataHoraBR(projeto.atualizadoEm)} por {projeto.atualizadoPor}
          <div id="conclusao-projeto" className="mt-3" />
        </CabecalhoPagina>
      </div>
      {usuario.papel === 'administrador' && avisos.confirmar === 'remover' ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4">
          <RemoverProjeto
            id={projeto.id}
            nome={projeto.nome}
            confirmar
            destinoConfirmar={`/projetos/${projeto.id}?confirmar=remover`}
            destinoCancelar={`/projetos/${projeto.id}`}
          />
        </div>
      ) : null}
      {avisos.erro ? <Recado tom="erro">{avisos.erro}</Recado> : null}
      {avisos.ok ? <Recado tom="ok">{avisos.ok}</Recado> : null}
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
        <div className="max-w-lg rounded-2xl border bg-card p-5 shadow-sm">
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
