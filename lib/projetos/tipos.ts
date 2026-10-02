import type { CapaPlanilha } from '@/lib/planilha/ler'

export type StatusProjeto = 'rascunho' | 'sem_planilha' | 'em_preenchimento' | 'concluido'

export const STATUS_PROJETO: Record<StatusProjeto, string> = {
  rascunho: 'Rascunho',
  sem_planilha: 'Sem planilha',
  em_preenchimento: 'Em preenchimento',
  concluido: 'Concluído',
}

/** Acréscimo interno de um item de serviço. Não sai na planilha. */
export type ExtraServico = {
  id: string
  reais: number | null
  percentual: number | null
}

export type Lancamento = {
  quantidade: string
  material: string
  maoDeObra: string
  valor?: string
  observacao?: string
  /** Valor antes dos extras. Permanece quando o campo visível passa a mostrar o final. */
  valorBase?: string
  extras?: ExtraServico[]
  /** Classificação do levantamento escolhida na tela. */
  status?: string
}

export type Projeto = {
  id: string
  nome: string
  data: string
  criadoEm: string
  criadoPor: string
  atualizadoEm: string
  atualizadoPor: string
  participantes: string[]
  arquivoNome: string | null
  arquivoGeradoNome: string | null
  concluidoEm: string | null
  concluidoPor: string | null
  capa: CapaPlanilha | null
  status: StatusProjeto
  lancamentos: Record<string, Lancamento>
}

export type ProjetoLista = Pick<
  Projeto,
  'id' | 'nome' | 'data' | 'status' | 'criadoPor' | 'atualizadoEm' | 'atualizadoPor' | 'arquivoNome'
>
