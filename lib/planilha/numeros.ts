/** Número como a pessoa digita: 11,8 ou 1.234,56. Vazio não vira zero. */
export function lerNumeroBR(bruto: string): number | null {
  const texto = bruto.trim()
  if (!texto) return null
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(texto)) return null
  const normal = texto.includes(',') ? texto.replaceAll('.', '').replace(',', '.') : texto
  const valor = Number(normal)
  if (!Number.isFinite(valor)) return null
  return valor
}

export function formatarNumeroBR(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(valor)
}

export function formatarMoedaBR(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

/** Número gravado pelo Excel (ponto) vira o texto que a pessoa vê (vírgula). */
export function numeroPlanilhaParaTela(bruto: string) {
  const texto = bruto.trim()
  if (/^\d+(\.\d+)?$/.test(texto)) return texto.replace('.', ',')
  return texto
}

export function dataHojeISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export function dataProjetoBR(iso: string) {
  const partes = iso.split('-')
  if (partes.length !== 3) return iso
  const [ano, mes, dia] = partes
  if (!ano || !mes || !dia) return iso
  return `${dia}/${mes}/${ano}`
}
