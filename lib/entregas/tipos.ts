export type TipoEntregaCatalogo = 'nova_funcionalidade' | 'melhoria' | 'correcao'

export type AreaEntrega = 'banco' | 'auth' | 'ui' | 'planilha' | 'docker' | 'docs' | 'saude'

export type StatusEntregaBase =
  | 'validado_producao'
  | 'nesta_versao'
  | 'planejado'
  | 'proposto'

export type StatusEntregaDecisao =
  | 'aguardando'
  | 'aprovado'
  | 'rollback'
  | 'adiado'
  | 'pedido_reversao'

export type AcaoEntrega = 'aprovar' | 'rollback' | 'passar_frente'

export type NivelConflito = 'ok' | 'alerta' | 'bloqueado' | 'nao_verificavel'

export type EntregaCatalogo = {
  id: string
  nome: string
  resumo: string
  tipo: TipoEntregaCatalogo
  versaoPrevista: string
  versaoEfetiva: string | null
  statusBase: StatusEntregaBase
  implantado: boolean
  ordemPrioridade: number
  dependsOn: string[]
  areas: AreaEntrega[]
  major?: boolean
}

export type EntregaEstadoRow = {
  entrega_id: string
  status: StatusEntregaDecisao
  posicao: number | null
  atualizado_por: string | null
  atualizado_em: string
}

export type ConflitoItem = {
  entregaId: string
  nivel: NivelConflito
  motivos: string[]
}

export type ParecerConflitos = {
  nivel: NivelConflito
  ordemAnalisada: string[]
  itens: ConflitoItem[]
}

export type EntregaResolvida = EntregaCatalogo & {
  statusDecisao: StatusEntregaDecisao | null
  posicao: number | null
  statusExibicao: string
  implantadoVisual: boolean
}

export type VisaoImplementacoes =
  | 'nova_funcionalidade'
  | 'melhoria'
  | 'correcao'
  | 'releases'

export type GateEsteira =
  | 'desenvolvimento'
  | 'validacao_dev'
  | 'homologacao'
  | 'aprovacao_producao'
  | 'deploy_producao'
  | 'validacao_producao'

export type StatusGateEsteira = 'pendente' | 'em_andamento' | 'concluido' | 'bloqueado'

export type EtapaTimeline =
  | 'implantado'
  | 'em_desenvolvimento'
  | 'proxima'
  | 'planejado'
  | 'futuro'

export type ComplexidadeEntrega = 'baixa' | 'media' | 'alta'

export type RiscoEntrega = 'baixo' | 'medio' | 'alto'

export type OrigemEntregaAtual = 'aprovada' | 'nesta_versao'

export type GateEsteiraEstado = {
  id: GateEsteira
  status: StatusGateEsteira
}

export type EntregaEsteira = EntregaResolvida & {
  complexidade: ComplexidadeEntrega
  risco: RiscoEntrega
  gates: GateEsteiraEstado[]
  ambiente: 'producao' | 'dev' | 'fila'
  proximoPasso: string
  aprovacaoNecessaria: string
}

export type ResumoSaudeEsteira = {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'
  versao: string
  build: string
  ambiente: string
  prerequisites: { status: string; mensagem: string }
  capacity: { status: string; mensagem: string }
  performance: { status: string; mensagem: string }
  parecerPerformance: string
  alertas: number
  erros: number
}

export type RelatorioRelease = {
  item: EntregaEsteira
  versao: string
  build: string | null
  commit: string | null
  testes: string
  health: string
  docs: string
  pendencias: string
  proximaSugerida: string | null
}

export type ProximoPassoEsteira = {
  texto: string
  gate: GateEsteira | null
  entregaId: string | null
}

export type ItemFuturo = {
  nome: string
  versao: string
}

export type PainelEsteira = {
  versaoProducao: string
  versaoDev: string
  build: string
  ambiente: string
  entregaAtual: EntregaEsteira | null
  origemAtual: OrigemEntregaAtual | null
  proximaSugerida: EntregaEsteira | null
  proximoPasso: ProximoPassoEsteira
  proximoGate: GateEsteira | null
  timeline: Record<EtapaTimeline, EntregaEsteira[]>
  roadmap: {
    agora: EntregaEsteira[]
    proximo: EntregaEsteira[]
    depois: EntregaEsteira[]
    futuro: ItemFuturo[]
  }
  ordemAtual: string[]
  ordemCatalogo: string[]
  ordemAtualNomes: string[]
  ordemCatalogoNomes: string[]
  ordemDiferente: boolean
  motivoOrdem: string
  parecer: ParecerConflitos
  historico: RelatorioRelease[]
  saude: ResumoSaudeEsteira | null
}
