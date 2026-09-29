import type {
  AreaEntrega,
  ComplexidadeEntrega,
  EtapaTimeline,
  NivelConflito,
  RiscoEntrega,
  StatusGateEsteira,
  TipoEntregaCatalogo,
  VisaoImplementacoes,
} from '@/lib/entregas/tipos'

export const TIPO_LABEL: Record<TipoEntregaCatalogo, string> = {
  nova_funcionalidade: 'Nova entrega',
  melhoria: 'Atualização',
  correcao: 'Correção',
}

export const VISOES: { id: VisaoImplementacoes; label: string }[] = [
  { id: 'releases', label: 'Ordem de releases' },
  { id: 'nova_funcionalidade', label: 'Novas entregas' },
  { id: 'melhoria', label: 'Atualizações' },
  { id: 'correcao', label: 'Correções' },
]

export const AREA_LABEL: Record<AreaEntrega, string> = {
  banco: 'Banco',
  auth: 'Acesso',
  ui: 'Interface',
  planilha: 'Planilha',
  docker: 'Docker',
  docs: 'Documentação',
  saude: 'Saúde',
}

export const NIVEL_LABEL: Record<NivelConflito, string> = {
  ok: 'Sem conflito',
  alerta: 'Alerta',
  bloqueado: 'Bloqueado',
  nao_verificavel: 'Não verificável',
}

export const COMPLEXIDADE_LABEL: Record<ComplexidadeEntrega, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
}

export const RISCO_LABEL: Record<RiscoEntrega, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
}

export const GATE_STATUS_LABEL: Record<StatusGateEsteira, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  bloqueado: 'Bloqueado',
}

export const TIMELINE_LABEL: Record<EtapaTimeline, string> = {
  implantado: 'Implantado',
  em_desenvolvimento: 'Em desenvolvimento',
  proxima: 'Próxima',
  planejado: 'Planejado',
  futuro: 'Futuro',
}

export const ROADMAP_LABEL = {
  agora: 'Agora',
  proximo: 'Próximo',
  depois: 'Depois',
  futuro: 'Futuro',
} as const

export function visaoValida(valor: string | undefined): VisaoImplementacoes {
  if (
    valor === 'nova_funcionalidade' ||
    valor === 'melhoria' ||
    valor === 'correcao' ||
    valor === 'releases'
  ) {
    return valor
  }
  return 'releases'
}
