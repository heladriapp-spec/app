import type { CapaPlanilha } from '@/lib/planilha/ler'

export type StatusProjeto = 'em_edicao' | 'em_execucao' | 'concluido'

export const STATUS_PROJETO: Record<StatusProjeto, string> = {
  em_edicao: 'Preparação',
  em_execucao: 'Em execução',
  concluido: 'Concluído',
}

/** Status antigos descreviam a mesma fase: o projeto ainda está com o autor. */
export function statusCanonico(bruto: string): StatusProjeto {
  if (bruto === 'em_execucao' || bruto === 'concluido' || bruto === 'em_edicao') return bruto
  return 'em_edicao'
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
  responsavelId: string | null
  responsavelEm: string | null
  submetidoEm: string | null
  previaLiberada: boolean
  capa: CapaPlanilha | null
  status: StatusProjeto
  lancamentos: Record<string, Lancamento>
}

export type ProjetoLista = Pick<
  Projeto,
  'id' | 'nome' | 'data' | 'status' | 'criadoPor' | 'atualizadoEm' | 'atualizadoPor' | 'arquivoNome'
>
