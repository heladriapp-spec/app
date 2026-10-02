import { COOKIE_RECADO, COOKIE_SESSAO, emitirSessao, lerSessao } from '@/lib/auth/sessao'
import { buscarUsuarioPublicoPorId, type UsuarioPublico } from '@/lib/operacao/store'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { redirect } from 'next/navigation'

export const usuarioDaSessao = cache(async (): Promise<UsuarioPublico | null> => {
  const jar = await cookies()
  const sessao = lerSessao(jar.get(COOKIE_SESSAO)?.value)
  if (!sessao) return null
  const usuario = await buscarUsuarioPublicoPorId(sessao.userId)
  if (!usuario || usuario.situacao !== 'ativa') return null
  if (usuario.sessaoGeracao !== sessao.geracao) return null
  return usuario
})

export async function requireUser() {
  const usuario = await usuarioDaSessao()
  if (!usuario) redirect('/login')
  return usuario
}

export async function requireAdmin() {
  const usuario = await requireUser()
  if (usuario.papel !== 'administrador') redirect('/')
  return usuario
}

export async function gravarSessao(userId: string, geracao = 0) {
  const jar = await cookies()
  jar.set(COOKIE_SESSAO, emitirSessao(userId, geracao), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function limparSessao() {
  const jar = await cookies()
  jar.delete(COOKIE_SESSAO)
  jar.delete(COOKIE_RECADO)
}

function opcoesRecado() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  }
}

export async function marcarRecadoDeEntrada() {
  const jar = await cookies()
  jar.set(COOKIE_RECADO, '1', opcoesRecado())
}

export async function limparRecadoDeEntrada() {
  const jar = await cookies()
  jar.delete(COOKIE_RECADO)
}
