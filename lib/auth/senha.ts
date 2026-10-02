import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

/** N=16384, r=8, p=1. Os hashes já gravados foram feitos com estes valores. */
const DERIVACAO = {
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
  maxmem: 32 * 1024 * 1024,
}

const MENTIRA = `${'ab'.repeat(16)}:${'cd'.repeat(32)}`

function derivarSenha(senha: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(senha, salt, 32, DERIVACAO, (erro, saida) => {
      if (erro) reject(erro)
      else resolve(saida)
    })
  })
}

export async function hashSenha(senha: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = (await derivarSenha(senha, salt)).toString('hex')
  return `${salt}:${hash}`
}

export async function confereSenha(senha: string, gravado: string) {
  const [salt, hash] = gravado.split(':')
  if (!salt || !hash) return false
  const calc = await derivarSenha(senha, salt)
  const alvo = Buffer.from(hash, 'hex')
  if (calc.length !== alvo.length) return false
  return timingSafeEqual(calc, alvo)
}

/** Gasta o mesmo tempo de uma senha real quando o login não existe. */
export async function consumirTempoDeSenha(senha: string) {
  await confereSenha(senha, MENTIRA)
}
