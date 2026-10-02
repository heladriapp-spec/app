import { carregarPlanilha } from '@/app/actions/projetos'
import { FormPlanilha } from '@/components/form-planilha'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { CotacaoTela } from '@/components/cotacao-tela'
import { NotaArquivoReferencial } from '@/components/arquivo-referencial'
import { Recado } from '@/components/recado'
import { ReguaProjeto } from '@/components/regua-projeto'
import { RemoverProjeto } from '@/components/remover-projeto'
import { PlanilhaTela } from '@/components/planilha-tela'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requireUser } from '@/lib/auth/guard'
import { dataHoraBR } from '@/lib/formato'
import { dataProjetoBR } from '@/lib/planilha/numeros'
import { pode } from '@/lib/projetos/acesso'
import { DOCUMENTO_SALVO, PROJETO_ENVIADO } from '@/lib/projetos/frases'
import { planilhaDoProjeto, projetoPorId, valoresDaCotacao } from '@/lib/projetos/store'
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
  const base = await projetoPorId(id, { valores: false })
  if (!base) notFound()
  if (!pode(usuario, base, 'ver')) redirect('/')

  const verValores = pode(usuario, base, 'ver_valores')
  const projeto = verValores ? await projetoPorId(id) : base
  if (!projeto) notFound()
  const podeRemover = pode(usuario, projeto, 'excluir')
  const lida = verValores ? await planilhaDoProjeto(projeto).catch(() => null) : null
  const baixarResultado = pode(usuario, projeto, 'baixar_gerado')

  return (
    <div className="flex flex-col gap-5">
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
            podeRemover && avisos.confirmar !== 'remover' ? (
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
          {dataProjetoBR(projeto.data)} · última alteração {dataHoraBR(projeto.atualizadoEm)} por{' '}
          {projeto.atualizadoPor}
        </CabecalhoPagina>
        <ReguaProjeto status={projeto.status} />
      </div>
      {podeRemover && avisos.confirmar === 'remover' ? (
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
      {avisos.ok && avisos.ok !== DOCUMENTO_SALVO ? <Recado tom="ok">{avisos.ok}</Recado> : null}
      {lida ? (
        <p className="text-sm text-muted-foreground">
          Salvar guarda o trabalho e mantém o projeto em preparação.
        </p>
      ) : null}
      {lida?.formato === 'cotacao' && lida.cotacao ? (
        <CotacaoTela
          projetoId={projeto.id}
          arquivoNome={projeto.arquivoNome}
          cotacao={lida.cotacao}
          iniciais={valoresDaCotacao(projeto, lida.cotacao)}
          salvo={avisos.ok === DOCUMENTO_SALVO}
        />
      ) : lida ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {lida.capa.aba}
            {lida.capa.processo ? ` · ${lida.capa.processo}` : ''}
            {lida.capa.evento ? ` · ${lida.capa.evento}` : ''}
            {lida.capa.unidade ? ` · ${lida.capa.unidade}` : ''}
          </p>
          <PlanilhaTela projeto={projeto} linhas={lida.linhas} salvo={avisos.ok === DOCUMENTO_SALVO} />
        </div>
      ) : verValores ? (
        <div className="max-w-lg rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-medium">Planilha referencial</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Este projeto ainda não tem arquivo. A tela de preenchimento abre quando a planilha for carregada.
            Sem ela, não dá para enviar para execução.
          </p>
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
        </div>
      ) : (
        <Acompanhamento
          status={projeto.status}
          enviado={avisos.ok === PROJETO_ENVIADO}
          baixar={baixarResultado ? projeto.id : null}
        />
      )}
    </div>
  )
}

function Acompanhamento({
  status,
  enviado,
  baixar,
}: {
  status: 'em_edicao' | 'em_execucao' | 'concluido'
  enviado: boolean
  baixar: string | null
}) {
  const texto = enviado
    ? 'Seu projeto foi enviado para execução. Aguardando um responsável. O formulário e o arquivo não vêm nesta tela.'
    : status === 'concluido'
      ? 'Este projeto está concluído. O preenchimento não pode mais ser alterado.'
      : status === 'em_execucao'
        ? 'Aguardando um responsável. O formulário e o arquivo não vêm nesta tela.'
        : 'Este projeto está em preparação com o autor.'

  return (
    <div className="max-w-lg rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-medium">
        {status === 'em_execucao' ? 'Projeto enviado' : status === 'concluido' ? 'Projeto concluído' : 'Preparação'}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
      {baixar ? (
        <div className="mt-4">
          <NotaArquivoReferencial nome={null} projetoId={baixar} gerado />
        </div>
      ) : null}
    </div>
  )
}
