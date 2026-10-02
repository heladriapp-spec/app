import { ehFuncaoAusente, supabaseConfigurado, chamarFuncao } from '@/lib/supabase/nuvem'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const JANELA_MS = 15 * 60 * 1000
const BLOQUEIO_MS = 15 * 60 * 1000
const LIMITE_LOGIN = 8
const LIMITE_IP = 30
const ARQUIVO = path.join(process.cwd(), 'data', 'tentativas-acesso.json')

type Registro = {
  falhas: number
  janelaInicio: number
  bloqueadoAte: number | null
}

let fila: Promise<unknown> = Promise.resolve()

export function ipDoCabecalho(encaminhado: string | null, direto: string | null) {
  const bruto = (encaminhado?.split(',')[0] ?? direto ?? '').trim()
  if (!bruto || bruto.length > 64) return null
  if (!/^[0-9a-fA-F:.]+$/.test(bruto)) return null
  return bruto.toLowerCase()
}

function chaveLogin(login: string) {
  return `login:${login.trim().toLowerCase().slice(0, 64)}`
}

function chaveIp(ip: string) {
  return `ip:${ip}`
}

function bloqueado(reg: Registro | undefined, agora: number) {
  return reg?.bloqueadoAte != null && reg.bloqueadoAte > agora
}

function somar(reg: Registro | undefined, limite: number, agora: number): Registro {
  if (reg && bloqueado(reg, agora)) return reg
  const naJanela = reg != null && agora - reg.janelaInicio < JANELA_MS
  const falhas = naJanela && reg ? reg.falhas + 1 : 1
  const janelaInicio = naJanela && reg ? reg.janelaInicio : agora
  return {
    falhas,
    janelaInicio,
    bloqueadoAte: falhas >= limite ? agora + BLOQUEIO_MS : null,
  }
}

function vigente(reg: Registro, agora: number) {
  if (reg.bloqueadoAte != null && reg.bloqueadoAte > agora) return true
  return agora - reg.janelaInicio < JANELA_MS
}

async function lerLocais() {
  try {
    const bruto = JSON.parse(await readFile(ARQUIVO, 'utf8')) as {
      itens?: { chave?: string; falhas?: number; janelaInicio?: number; bloqueadoAte?: number | null }[]
    }
    const mapa = new Map<string, Registro>()
    for (const item of bruto.itens ?? []) {
      if (!item.chave || typeof item.falhas !== 'number' || typeof item.janelaInicio !== 'number') continue
      mapa.set(item.chave, {
        falhas: item.falhas,
        janelaInicio: item.janelaInicio,
        bloqueadoAte: typeof item.bloqueadoAte === 'number' ? item.bloqueadoAte : null,
      })
    }
    return mapa
  } catch {
    return new Map<string, Registro>()
  }
}

async function gravarLocais(mapa: Map<string, Registro>, agora: number) {
  const itens = [...mapa.entries()]
    .filter(([, reg]) => vigente(reg, agora))
    .map(([chave, reg]) => ({ chave, ...reg }))
  await mkdir(path.dirname(ARQUIVO), { recursive: true })
  await writeFile(ARQUIVO, JSON.stringify({ itens }, null, 2), { mode: 0o600 })
}

async function alterarLocais<T>(fn: (mapa: Map<string, Registro>, agora: number) => T): Promise<T> {
  const exec = fila.then(async () => {
    const agora = Date.now()
    const mapa = await lerLocais()
    const resultado = fn(mapa, agora)
    await gravarLocais(mapa, agora)
    return resultado
  })
  fila = exec.then(
    () => undefined,
    () => undefined,
  )
  return exec
}

async function bloqueadoLocal(chave: string) {
  return alterarLocais((mapa, agora) => bloqueado(mapa.get(chave), agora))
}

async function registrarLocal(chave: string, limite: number) {
  await alterarLocais((mapa, agora) => {
    mapa.set(chave, somar(mapa.get(chave), limite, agora))
  })
}

async function limparLocal(chave: string) {
  await alterarLocais((mapa) => {
    mapa.delete(chave)
  })
}

async function naNuvem<T>(fn: () => Promise<T>, local: () => Promise<T>) {
  if (!supabaseConfigurado()) return local()
  try {
    return await fn()
  } catch (erro) {
    if (ehFuncaoAusente(erro)) return local()
    throw erro
  }
}

async function estaBloqueado(chave: string) {
  return naNuvem(
    async () => (await chamarFuncao<boolean>('acesso_bloqueado', { p_chave: chave })) === true,
    () => bloqueadoLocal(chave),
  )
}

async function registrar(chave: string, limite: number) {
  await naNuvem(
    () =>
      chamarFuncao<void>('registrar_falha_acesso', {
        p_chave: chave,
        p_limite: limite,
        p_janela_seg: JANELA_MS / 1000,
        p_bloqueio_seg: BLOQUEIO_MS / 1000,
      }),
    () => registrarLocal(chave, limite),
  )
}

async function limpar(chave: string) {
  await naNuvem(
    () => chamarFuncao<void>('limpar_tentativa_acesso', { p_chave: chave }),
    () => limparLocal(chave),
  )
}

function alvos(login: string, ip: string | null) {
  const lista: [string, number][] = [[chaveLogin(login), LIMITE_LOGIN]]
  if (ip) lista.push([chaveIp(ip), LIMITE_IP])
  return lista
}

export async function loginBloqueado(login: string, ip: string | null) {
  for (const [chave] of alvos(login, ip)) {
    if (await estaBloqueado(chave)) return true
  }
  return false
}

export async function registrarFalhaDeLogin(login: string, ip: string | null) {
  for (const [chave, limite] of alvos(login, ip)) {
    await registrar(chave, limite)
  }
}

export async function limparFalhasDeLogin(login: string) {
  await limpar(chaveLogin(login))
}
