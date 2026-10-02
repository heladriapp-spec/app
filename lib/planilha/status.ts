export type OpcaoStatus = { status: string; texto: string }

/** Legenda do levantamento, usada quando a planilha não traz o bloco. */
export const STATUS_LEVANTAMENTO: OpcaoStatus[] = [
  {
    status: 'EXPLÍCITO',
    texto: 'Dado quantitativo ou especificação presente diretamente no memorial / desenho.',
  },
  {
    status: 'DERIVADO',
    texto:
      'Dado calculado matematicamente a partir de parâmetros das fontes (ex: consumo de tinta/ignífugo).',
  },
  {
    status: 'PENDENTE',
    texto: 'Informação que depende de definição executiva, medição in loco ou cotação detalhada.',
  },
  {
    status: 'DIVERGENTE',
    texto: 'Conflito identificado entre diferentes memoriais do projeto (ex: massas de lastro).',
  },
  {
    status: 'FECHADO',
    texto: 'Item com cotação de mercado confirmada e fechada.',
  },
  {
    status: 'REFORMADO',
    texto: 'Elemento existente no acervo do SESC que passará por tratamento, pintura ou restauração.',
  },
]

const ABERTOS = new Set(['PENDENTE', 'DIVERGENTE'])

export function chaveStatus(status: string) {
  return status
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .trim()
}

export function opcoesStatus(legenda: OpcaoStatus[]) {
  return legenda.length > 0 ? legenda : STATUS_LEVANTAMENTO
}

export function canonizarStatus(valor: string, opcoes: OpcaoStatus[]) {
  const chave = chaveStatus(valor)
  if (!chave) return ''
  return opcoes.find((item) => chaveStatus(item.status) === chave)?.status ?? ''
}

/** Item classificado e sem pendência ou conflito. */
export function statusAderente(status: string) {
  const chave = chaveStatus(status)
  return chave.length > 0 && !ABERTOS.has(chave)
}

export function adesaoDe(statuses: string[]) {
  if (statuses.length === 0) return null
  const aderentes = statuses.filter(statusAderente).length
  return {
    total: statuses.length,
    aderentes,
    percentual: Math.round((aderentes / statuses.length) * 100),
  }
}
