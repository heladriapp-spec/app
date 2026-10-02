import 'server-only'

import { headers } from 'next/headers'
import { enviarEmail } from '@/lib/email/smtp'

export async function origemPublica() {
  const fixa = process.env.APP_URL?.trim() ?? ''
  if (fixa) {
    try {
      const url = new URL(fixa)
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin
    } catch {
      return ''
    }
  }
  const recebidos = await headers()
  const host = (recebidos.get('x-forwarded-host') ?? recebidos.get('host') ?? '').split(',')[0]?.trim()
  if (!host || /[\s/]/.test(host)) return ''
  const proto = (recebidos.get('x-forwarded-proto') ?? 'http').split(',')[0]?.trim()
  if (proto !== 'http' && proto !== 'https') return ''
  return `${proto}://${host}`
}

export async function enviarConfirmacao(email: string, nome: string, token: string) {
  const origem = await origemPublica()
  if (!origem) return { ok: false as const, motivo: 'falha' as const }
  const link = `${origem}/confirmar/${token}`
  return enviarEmail(
    email,
    'Confirme seu acesso ao Heladri',
    [
      `Olá, ${nome}.`,
      '',
      'O administrador aprovou seu pedido de acesso ao Heladri.',
      'Abra o link para definir a sua senha. O e-mail já é o seu login.',
      'Ele vale 24 horas e funciona uma vez.',
      '',
      link,
      '',
      'Se você não pediu este acesso, ignore esta mensagem.',
      'A senha não vai neste e-mail.',
    ].join('\n'),
  )
}

export async function enviarRecuperacao(email: string, token: string) {
  const origem = await origemPublica()
  if (!origem) return { ok: false as const, motivo: 'falha' as const }
  const link = `${origem}/nova-senha/${token}`
  return enviarEmail(
    email,
    'Defina uma senha nova no Heladri',
    [
      'Você pediu para definir uma senha nova no Heladri.',
      'Abra o link abaixo. Ele vale 24 horas e funciona uma vez.',
      'A senha atual não vai nesta mensagem.',
      '',
      link,
      '',
      'Se você não pediu, ignore. A senha de agora continua valendo.',
    ].join('\n'),
  )
}
