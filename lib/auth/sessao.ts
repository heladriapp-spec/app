import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ARQUIVO = path.join(process.cwd(), 'data', 'segredo-sessao')

function segredo() {
  const definido = process.env.SEGREDO_SESSAO?.trim() ?? ''
  if (definido) {
    if (definido.length < 32) throw new Error('SEGREDO_SESSAO precisa de ao menos 32 caracteres.')
    return definido
  }
  const pasta = path.dirname(ARQUIVO)
  if (!existsSync(pasta)) mkdirSync(pasta, { recursive: true })
  if (!existsSync(ARQUIVO)) {
    writeFileSync(ARQUIVO, randomBytes(32).toString('hex'), { mode: 0o600 })
  }
  return readFileSync(ARQUIVO, 'utf8').trim()
}

function assinar(corpo: string) {
  return createHmac('sha256', segredo()).update(corpo).digest('base64url')
}

export function emitirSessao(userId: string) {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000
  const corpo = `${userId}.${exp}`
  return `${corpo}.${assinar(corpo)}`
}

export function lerSessao(token: string | undefined) {
  if (!token) return null
  const partes = token.split('.')
  if (partes.length !== 3) return null
  const [userId, exp, mac] = partes
  if (!userId || !exp || !mac) return null
  const esperado = assinar(`${userId}.${exp}`)
  const a = Buffer.from(mac)
  const b = Buffer.from(esperado)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (Number(exp) < Date.now()) return null
  return userId
}

export const COOKIE_SESSAO = 'heladri_sessao'
export const COOKIE_RECADO = 'heladri_recado'
