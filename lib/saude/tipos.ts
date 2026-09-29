export type StatusCheck = 'ok' | 'alerta' | 'erro' | 'nao_aplicavel'

export type StatusSaude = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'

export type GrupoCheck = 'ambiente' | 'produto'

export type CheckResultado = {
  id: string
  nome: string
  grupo: GrupoCheck
  status: StatusCheck
  criticidade: 'critico' | 'nao_critico'
  mensagem: string
  detalhe: string | null
  duracaoMs: number
}

export type ContagemSaude = {
  ok: number
  alerta: number
  erro: number
  naoAplicavel: number
}

export type ResumoEixo = {
  status: StatusCheck
  mensagem: string
}

export type RelatorioSaude = {
  status: StatusSaude
  versao: string
  versaoPublica: string
  build: string
  ambiente: string
  runtime: string
  momento: string
  duracaoMs: number
  contagem: ContagemSaude
  checks: CheckResultado[]
  prerequisites: ResumoEixo
  capacity: ResumoEixo
}
