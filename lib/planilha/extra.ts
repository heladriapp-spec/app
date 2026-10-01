import type { ExtraServico } from '@/lib/projetos/tipos'
import { formatarMoedaBR, formatarNumeroBR } from '@/lib/planilha/numeros'

const TETO = 1_000_000_000

export function centavos(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/** Percentual incide sempre sobre o valor base, nunca sobre o valor já acrescido. */
export function valorFinalServico(base: number, extras: ExtraServico[]) {
  const acrescimo = extras.reduce((soma, extra) => {
    const reais = extra.reais ?? 0
    const percentual = extra.percentual ?? 0
    return soma + reais + centavos((base * percentual) / 100)
  }, 0)
  return centavos(base + acrescimo)
}

export function formatarPercentualBR(valor: number) {
  const texto = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
  return `${texto}%`
}

export function rotuloExtra(extra: ExtraServico) {
  const partes: string[] = []
  if (extra.reais != null) partes.push(formatarMoedaBR(extra.reais))
  if (extra.percentual != null) partes.push(formatarPercentualBR(extra.percentual))
  return partes.join(' + ')
}

export function mascaraMoeda(bruto: string) {
  return mascaraCentavos(bruto, 12, formatarMoedaBR)
}

export function mascaraPercentual(bruto: string) {
  return mascaraCentavos(bruto, 7, formatarPercentualBR)
}

export function lerMascara(bruto: string): number | null {
  const digitos = bruto.replace(/\D/g, '')
  if (!digitos) return null
  const valor = Number(digitos) / 100
  if (!Number.isFinite(valor)) return null
  return valor
}

/** Rascunho com pelo menos um acréscimo maior que zero. Zero sozinho não vira extra. */
export function rascunhoExtra(id: string, reaisTexto: string, percentualTexto: string): ExtraServico | null {
  const reais = positivo(lerMascara(reaisTexto))
  const percentual = positivo(lerMascara(percentualTexto))
  if (reais == null && percentual == null) return null
  return { id, reais, percentual }
}

export function lerExtras(
  bruto: string,
): { ok: true; extras: ExtraServico[] } | { ok: false } {
  const texto = bruto.trim()
  if (!texto) return { ok: true, extras: [] }
  let dados: unknown
  try {
    dados = JSON.parse(texto)
  } catch {
    return { ok: false }
  }
  if (!Array.isArray(dados) || dados.length > 20) return { ok: false }
  const extras: ExtraServico[] = []
  for (const item of dados) {
    if (!item || typeof item !== 'object') return { ok: false }
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || !/^[\w-]{1,40}$/.test(row.id)) return { ok: false }
    const reais = numeroOpcional(row.reais)
    const percentual = numeroOpcional(row.percentual)
    if (reais === 'invalido' || percentual === 'invalido') return { ok: false }
    if (reais == null && percentual == null) return { ok: false }
    extras.push({ id: row.id, reais, percentual })
  }
  return { ok: true, extras }
}

export function valorExportado(base: number, extras: ExtraServico[]) {
  return formatarNumeroBR(valorFinalServico(base, extras))
}

function mascaraCentavos(bruto: string, limite: number, formatar: (valor: number) => string) {
  const digitos = bruto.replace(/\D/g, '').slice(0, limite)
  if (!digitos) return ''
  const valor = Number(digitos) / 100
  if (!Number.isFinite(valor) || valor > TETO) return ''
  return formatar(valor)
}

function positivo(valor: number | null) {
  if (valor == null || valor <= 0 || valor > TETO) return null
  return centavos(valor)
}

function numeroOpcional(valor: unknown): number | null | 'invalido' {
  if (valor == null) return null
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0 || valor > TETO) {
    return 'invalido'
  }
  return centavos(valor)
}
