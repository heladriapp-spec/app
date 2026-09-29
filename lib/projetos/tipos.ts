import type { CapaPlanilha } from '@/lib/planilha/ler'

export type StatusProjeto = 'sem_planilha' | 'em_preenchimento'

export type Lancamento = {
  quantidade: string
  material: string
  maoDeObra: string
  valor?: string
  observacao?: string
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
  capa: CapaPlanilha | null
  status: StatusProjeto
  lancamentos: Record<string, Lancamento>
}

export type ProjetoLista = Pick<
  Projeto,
  'id' | 'nome' | 'data' | 'status' | 'atualizadoEm' | 'atualizadoPor' | 'arquivoNome'
>
