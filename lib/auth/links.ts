import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export type TipoLink = 'confirmacao' | 'senha'

export type LinkAcesso = {
  id: string
  tipo: TipoLink
  email: string
  pedidoId: string | null
  usuarioId: string | null
  tokenHash: string
  criadoEm: string
  expiraEm: string
  usadoEm: string | null
}

const PRAZO_MS = 24 * 60 * 60 * 1000
const RETENCAO_MS = 7 * 24 * 60 * 60 * 1000
export const INTERVALO_SENHA_MS = 2 * 60 * 1000

export function hashDoToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function tokenInformado(bruto: string) {
  const token = bruto.trim()
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  return token
}

export function criarLink(
  entrada: { tipo: TipoLink; email: string; pedidoId: string | null; usuarioId: string | null },
  agora = Date.now(),
) {
  const token = randomBytes(32).toString('base64url')
  const link: LinkAcesso = {
    id: crypto.randomUUID(),
    tipo: entrada.tipo,
    email: entrada.email,
    pedidoId: entrada.pedidoId,
    usuarioId: entrada.usuarioId,
    tokenHash: hashDoToken(token),
    criadoEm: new Date(agora).toISOString(),
    expiraEm: new Date(agora + PRAZO_MS).toISOString(),
    usadoEm: null,
  }
  return { token, link }
}

export function emitirLink(
  links: LinkAcesso[],
  entrada: { tipo: TipoLink; email: string; pedidoId: string | null; usuarioId: string | null },
) {
  const agora = Date.now()
  const restantes = links.filter((link) => {
    const usado = link.usadoEm ? Date.parse(link.usadoEm) : null
    if (usado != null && agora - usado > RETENCAO_MS) return false
    if (usado == null && agora > Date.parse(link.expiraEm) + RETENCAO_MS) return false
    return true
  })
  for (const link of restantes) {
    if (link.tipo === entrada.tipo && link.email === entrada.email && !link.usadoEm) {
      link.usadoEm = new Date(agora).toISOString()
    }
  }
  const { token, link } = criarLink(entrada, agora)
  restantes.push(link)
  links.splice(0, links.length, ...restantes)
  return token
}

export function linkRecente(links: LinkAcesso[], tipo: TipoLink, email: string) {
  const agora = Date.now()
  return links.some(
    (link) =>
      link.tipo === tipo &&
      link.email === email &&
      !link.usadoEm &&
      agora - Date.parse(link.criadoEm) < INTERVALO_SENHA_MS,
  )
}

export function acharLink(links: LinkAcesso[], token: string) {
  const hash = hashDoToken(token)
  const alvo = Buffer.from(hash, 'hex')
  return (
    links.find((link) => {
      const gravado = Buffer.from(link.tokenHash, 'hex')
      if (gravado.length !== alvo.length) return false
      return timingSafeEqual(gravado, alvo)
    }) ?? null
  )
}

export function motivoDoLink(link: LinkAcesso | null, tipo: TipoLink) {
  if (!link || link.tipo !== tipo) return 'Este link não vale.'
  if (link.usadoEm) return 'Este link já foi usado.'
  if (Date.parse(link.expiraEm) <= Date.now()) return 'Este link expirou.'
  return null
}
