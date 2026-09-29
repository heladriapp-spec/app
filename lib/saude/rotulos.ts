import type { StatusCheck, StatusSaude } from '@/lib/saude/tipos'

export const STATUS_SAUDE_LABEL: Record<StatusSaude, string> = {
  HEALTHY: 'Saudável',
  DEGRADED: 'Degradado',
  UNHEALTHY: 'Indisponível',
}

export const STATUS_CHECK_LABEL: Record<StatusCheck, string> = {
  ok: 'Ok',
  alerta: 'Alerta',
  erro: 'Erro',
  nao_aplicavel: 'Não aplicável',
}

export const GRUPO_CHECK_LABEL = {
  ambiente: 'Ambiente',
  produto: 'Produto Heladri',
} as const
