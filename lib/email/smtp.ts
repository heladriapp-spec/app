import 'server-only'

import net from 'node:net'
import tls from 'node:tls'

type Seguro = 'tls' | 'starttls' | 'nao'

type Remetente = {
  host: string
  port: number
  seguro: Seguro
  user: string
  password: string
  from: string
}

export function remetenteConfigurado() {
  return lerRemetente() != null
}

export async function enviarEmail(para: string, assunto: string, texto: string) {
  const cfg = lerRemetente()
  if (!cfg) return { ok: false as const, motivo: 'sem_remetente' as const }
  if (!emailAceito(para) || /[\r\n]/.test(assunto) || /[\r\n]/.test(cfg.from)) {
    return { ok: false as const, motivo: 'falha' as const }
  }
  try {
    await transmitir(cfg, para, assunto, texto)
    return { ok: true as const }
  } catch {
    return { ok: false as const, motivo: 'falha' as const }
  }
}

function lerRemetente(): Remetente | null {
  const host = process.env.SMTP_HOST?.trim() ?? ''
  const user = process.env.SMTP_USER?.trim() ?? ''
  const password = process.env.SMTP_PASSWORD ?? ''
  const from = process.env.EMAIL_FROM?.trim() ?? ''
  const port = Number(process.env.SMTP_PORT || '587')
  if (!host || !user || !password.trim() || !from || !Number.isFinite(port)) return null
  const pedido = (process.env.SMTP_SEGURO || '').trim().toLowerCase()
  let seguro: Seguro = port === 465 ? 'tls' : 'starttls'
  if (pedido === 'tls' || pedido === 'starttls' || pedido === 'nao') seguro = pedido
  return { host, port, seguro, user, password, from }
}

function emailAceito(valor: string) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(valor)
}

function emailDoCampo(from: string) {
  const entre = /<([^>]+)>/.exec(from)
  return (entre?.[1] ?? from).trim()
}

function assuntoHeader(assunto: string) {
  if (/^[\x20-\x7E]*$/.test(assunto)) return assunto
  return `=?UTF-8?B?${Buffer.from(assunto, 'utf8').toString('base64')}?=`
}

class Linhas {
  private buf = ''
  private fila: string[] = []
  private espera: ((linha: string) => void) | null = null
  private falha: ((erro: Error) => void) | null = null

  constructor(private socket: net.Socket) {
    socket.setEncoding('utf8')
    socket.setTimeout(20_000)
    socket.on('data', (chunk: string) => this.receber(chunk))
    socket.on('error', (erro) => this.falha?.(erro))
    socket.on('timeout', () => this.falha?.(new Error('smtp timeout')))
  }

  private receber(chunk: string) {
    this.buf += chunk
    let corte = this.buf.indexOf('\n')
    while (corte >= 0) {
      const linha = this.buf.slice(0, corte).replace(/\r$/, '')
      this.buf = this.buf.slice(corte + 1)
      if (this.espera) {
        const resolve = this.espera
        this.espera = null
        resolve(linha)
      } else {
        this.fila.push(linha)
      }
      corte = this.buf.indexOf('\n')
    }
  }

  private async linha() {
    const pronta = this.fila.shift()
    if (pronta !== undefined) return pronta
    return new Promise<string>((resolve, reject) => {
      this.espera = resolve
      this.falha = reject
    })
  }

  async resposta() {
    const linhas: string[] = []
    for (;;) {
      const linha = await this.linha()
      linhas.push(linha)
      if (/^\d{3} /.test(linha)) return Number(linha.slice(0, 3))
      if (!/^\d{3}-/.test(linha)) throw new Error('smtp')
    }
  }

  async comando(cmd: string | null, esperado: number) {
    if (cmd != null) this.socket.write(`${cmd}\r\n`)
    const codigo = await this.resposta()
    if (codigo !== esperado) throw new Error('smtp')
  }

  soltar() {
    this.socket.removeAllListeners('data')
    this.socket.removeAllListeners('error')
    this.socket.removeAllListeners('timeout')
  }

  fechar() {
    this.socket.destroy()
  }

  base() {
    return this.socket
  }
}

async function abrir(cfg: Remetente) {
  if (cfg.seguro === 'tls') return conectarTls(cfg.host, cfg.port)
  const sessao = await conectarTcp(cfg.host, cfg.port)
  await sessao.comando(null, 220)
  await sessao.comando('EHLO heladri', 250)
  if (cfg.seguro === 'nao') return sessao
  await sessao.comando('STARTTLS', 220)
  const cru = sessao.base()
  sessao.soltar()
  const seguro = await promover(cru, cfg.host)
  const depois = new Linhas(seguro)
  await depois.comando('EHLO heladri', 250)
  return depois
}

function conectarTcp(host: string, port: number) {
  const socket = new net.Socket()
  const sessao = new Linhas(socket)
  return new Promise<Linhas>((resolve, reject) => {
    socket.connect({ host, port }, () => resolve(sessao))
    socket.once('error', reject)
  })
}

function conectarTls(host: string, port: number) {
  const socket = tls.connect({ host, port, servername: host })
  const sessao = new Linhas(socket)
  return new Promise<Linhas>((resolve, reject) => {
    socket.once('secureConnect', () => resolve(sessao))
    socket.once('error', reject)
  })
}

function promover(socket: net.Socket, host: string) {
  return new Promise<tls.TLSSocket>((resolve, reject) => {
    const seguro = tls.connect({ socket, servername: host }, () => resolve(seguro))
    seguro.once('error', reject)
  })
}

async function transmitir(cfg: Remetente, para: string, assunto: string, texto: string) {
  const sessao = await abrir(cfg)
  try {
    if (cfg.seguro === 'tls') {
      await sessao.comando(null, 220)
      await sessao.comando('EHLO heladri', 250)
    }
    const auth = Buffer.from(`\0${cfg.user}\0${cfg.password}`).toString('base64')
    await sessao.comando(`AUTH PLAIN ${auth}`, 235)
    await sessao.comando(`MAIL FROM:<${emailDoCampo(cfg.from)}>`, 250)
    await sessao.comando(`RCPT TO:<${para}>`, 250)
    await sessao.comando('DATA', 354)
    const corpo = texto.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..')
    const mensagem = [
      `From: ${cfg.from}`,
      `To: ${para}`,
      `Subject: ${assuntoHeader(assunto)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      corpo,
      '',
    ].join('\r\n')
    await sessao.comando(`${mensagem}.`, 250)
    await sessao.comando('QUIT', 221)
  } finally {
    sessao.fechar()
  }
}
