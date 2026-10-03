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
import { HistoricoPreenchimento } from '@/components/historico-preenchimento'
import { ParticipantesProjeto } from '@/components/participantes-projeto'
import { pode } from '@/lib/projetos/acesso'
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
  const projeto = verValores ? await projetoPorId(id) : base
  if (!projeto) notFound()
  const podeRemover = pode(usuario, projeto, 'excluir')
  const verHistorico = pode(usuario, projeto, 'ver_historico')
  const podeRestaurar = pode(usuario, projeto, 'restaurar')
  const podeExcluirItem = pode(usuario, projeto, 'excluir_item')
  const podeGerir = pode(usuario, projeto, 'gerir_participantes')
  const lida = verValores ? await planilhaDoProjeto(projeto).catch(() => null) : null
  const baixarResultado = pode(usuario, projeto, 'baixar_gerado')
  const [versoes, entradas, contas] = await Promise.all([
    verHistorico ? listarVersoesVisiveis(id) : Promise.resolve([]),
    listarEntradasParticipante(id),
    listarUsuariosPublicos(),
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
      {lida ? (
        <p className="text-sm text-muted-foreground">
          Salvar guarda o trabalho e mantém o projeto em preparação. Se um campo mudou, entra uma versão.
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
      ) : (
        <Acompanhamento
          status={projeto.status}
          enviado={avisos.ok === PROJETO_ENVIADO}
          baixar={baixarResultado ? projeto.id : null}
        />
      )}
      {verHistorico ? (
        <HistoricoPreenchimento projetoId={projeto.id} versoes={versoes} podeRestaurar={podeRestaurar} />
      ) : null}
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
