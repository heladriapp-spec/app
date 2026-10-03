import { alternarPrevia, assumirProjeto, carregarPlanilha, devolverProjeto } from '@/app/actions/projetos'
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
import { HistoricoPreenchimento } from '@/components/historico-preenchimento'
import { TrilhaProjeto } from '@/components/trilha-projeto'
import { ParticipantesProjeto } from '@/components/participantes-projeto'
import { pode } from '@/lib/projetos/acesso'
import { listarTrilha } from '@/lib/projetos/eventos'
import { DOCUMENTO_SALVO, PROJETO_ENVIADO } from '@/lib/projetos/frases'
import { listarEntradasParticipante, listarVersoesVisiveis } from '@/lib/projetos/historico'
import { planilhaDoProjeto, projetoPorId, valoresDaCotacao } from '@/lib/projetos/store'
import { listarUsuariosPublicos } from '@/lib/operacao/store'
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
  const podeEditar = pode(usuario, base, 'editar')
  const podeAssumir = pode(usuario, base, 'assumir')
  const projeto = verValores ? await projetoPorId(id) : base
  if (!projeto) notFound()
  const podeRemover = pode(usuario, projeto, 'excluir')
  const verHistorico = pode(usuario, projeto, 'ver_historico')
  const podeRestaurar = pode(usuario, projeto, 'restaurar')
  const podeExcluirItem = pode(usuario, projeto, 'excluir_item')
  const podeGerir = pode(usuario, projeto, 'gerir_participantes')
  const lida = verValores ? await planilhaDoProjeto(projeto).catch(() => null) : null
  const baixarResultado = pode(usuario, projeto, 'baixar_gerado')
  const baixarOrigem = pode(usuario, projeto, 'baixar_origem')
  const podeDevolver = pode(usuario, projeto, 'devolver')
  const podeLiberar = pode(usuario, projeto, 'liberar_previa')
  const podeRecolher = pode(usuario, projeto, 'recolher_previa')
  const somenteLeitura = verValores && !podeEditar
  const etapa = projeto.status === 'em_execucao' ? 'execucao' : 'preparacao'
  const [versoes, entradas, contas, trilha] = await Promise.all([
    verHistorico ? listarVersoesVisiveis(id) : Promise.resolve([]),
    listarEntradasParticipante(id),
    listarUsuariosPublicos(),
    listarTrilha(id),
  ])
  const resumoConta = (conta: { id: string; nome: string; login: string }) => ({
    id: conta.id,
    nome: conta.nome,
    login: conta.login,
  })
  const pessoas = contas.filter((conta) => projeto.participantes.includes(conta.id)).map(resumoConta)
  const candidatos = podeGerir
    ? contas
        .filter((conta) => conta.ativo && !projeto.participantes.includes(conta.id))
        .map(resumoConta)
    : []

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
      {podeDevolver || podeLiberar || podeRecolher ? (
        <ExecucaoResponsavel
          id={projeto.id}
          liberar={podeLiberar}
          recolher={podeRecolher}
        />
      ) : null}
      {lida ? (
        <p className="text-sm text-muted-foreground">
          {somenteLeitura
            ? 'Prévia liberada. Você lê os valores. O arquivo não é baixado nesta etapa.'
            : etapa === 'execucao'
              ? 'Salvar guarda o trabalho e mantém o projeto em execução. Concluir gera o arquivo final. Antes disso, o download é recusado.'
              : 'Salvar guarda o trabalho e mantém o projeto em preparação. Se um campo mudou, entra uma versão.'}
        </p>
      ) : null}
      <ParticipantesProjeto
        projetoId={projeto.id}
        autorLogin={projeto.criadoPor}
        pessoas={pessoas}
        candidatos={candidatos}
        entradas={entradas}
        podeGerir={podeGerir}
      />
      {lida?.formato === 'cotacao' && lida.cotacao ? (
        <CotacaoTela
          projetoId={projeto.id}
          arquivoNome={projeto.arquivoNome}
          cotacao={lida.cotacao}
          iniciais={valoresDaCotacao(projeto, lida.cotacao)}
          salvo={avisos.ok === DOCUMENTO_SALVO}
          podeExcluir={podeExcluirItem}
          etapa={etapa}
          mostrarArquivo={baixarOrigem}
          somenteLeitura={somenteLeitura}
        />
      ) : lida ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {lida.capa.aba}
            {lida.capa.processo ? ` · ${lida.capa.processo}` : ''}
            {lida.capa.evento ? ` · ${lida.capa.evento}` : ''}
            {lida.capa.unidade ? ` · ${lida.capa.unidade}` : ''}
          </p>
          <PlanilhaTela
            projeto={projeto}
            linhas={lida.linhas}
            salvo={avisos.ok === DOCUMENTO_SALVO}
            podeExcluir={podeExcluirItem}
            etapa={etapa}
            mostrarArquivo={baixarOrigem}
            somenteLeitura={somenteLeitura}
          />
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
      ) : podeAssumir ? (
        <Assumir id={projeto.id} />
      ) : (
        <Acompanhamento
          status={projeto.status}
          enviado={avisos.ok === PROJETO_ENVIADO}
          baixar={baixarResultado ? projeto.id : null}
          temResponsavel={Boolean(projeto.responsavelId)}
        />
      )}
      <TrilhaProjeto eventos={trilha} />
      {verHistorico ? (
        <HistoricoPreenchimento projetoId={projeto.id} versoes={versoes} podeRestaurar={podeRestaurar} />
      ) : null}
    </div>
  )
}

function ExecucaoResponsavel({
  id,
  liberar,
  recolher,
}: {
  id: string
  liberar: boolean
  recolher: boolean
}) {
  return (
    <div className="flex max-w-lg flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-medium">Prévia e devolução</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Liberar a prévia mostra os valores ao autor, sem download. Devolver volta para preparação,
          pede o motivo e tira você da responsabilidade.
        </p>
      </div>
      {liberar || recolher ? (
        <form action={alternarPrevia}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="acao" value={liberar ? 'liberar' : 'recolher'} />
          <Button type="submit" variant="outline">
            {liberar ? 'Liberar prévia' : 'Recolher prévia'}
          </Button>
        </form>
      ) : null}
      <form action={devolverProjeto} className="grid gap-2">
        <Label htmlFor={`motivo-${id}`}>Motivo da devolução</Label>
        <textarea
          id={`motivo-${id}`}
          name="motivo"
          required
          minLength={3}
          maxLength={400}
          rows={3}
          className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
        />
        <Button type="submit" variant="outline">
          Devolver
        </Button>
      </form>
    </div>
  )
}

function Assumir({ id }: { id: string }) {
  return (
    <div className="max-w-lg rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-medium">Fila de execução</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Este projeto espera um responsável. Assumir deixa a edição e a conclusão com você. O download
        continua recusado até concluir.
      </p>
      <form action={assumirProjeto} className="mt-4">
        <input type="hidden" name="id" value={id} />
        <Button type="submit">Assumir</Button>
      </form>
    </div>
  )
}

function Acompanhamento({
  status,
  enviado,
  baixar,
  temResponsavel,
}: {
  status: 'em_edicao' | 'em_execucao' | 'concluido'
  enviado: boolean
  baixar: string | null
  temResponsavel: boolean
}) {
  const texto = enviado
    ? 'Seu projeto foi enviado para execução. Aguardando um responsável. O formulário e o arquivo não vêm nesta tela.'
    : status === 'concluido'
      ? baixar
        ? 'Este projeto está concluído. Baixe o arquivo final.'
        : 'Este projeto está concluído. O preenchimento não pode mais ser alterado.'
      : status === 'em_execucao'
        ? temResponsavel
          ? 'Um responsável assumiu o projeto. Os valores aparecem aqui se a prévia for liberada. O arquivo não vem nesta tela.'
          : 'Aguardando um responsável. O formulário e o arquivo não vêm nesta tela.'
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
