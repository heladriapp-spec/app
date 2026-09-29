import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export function hashSenha(senha: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(senha, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

export function confereSenha(senha: string, gravado: string) {
  const [salt, hash] = gravado.split(':')
  if (!salt || !hash) return false
  const calc = scryptSync(senha, salt, 32)
  const alvo = Buffer.from(hash, 'hex')
  if (calc.length !== alvo.length) return false
  return timingSafeEqual(calc, alvo)
}
