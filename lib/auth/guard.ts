import { COOKIE_SESSAO, emitirSessao, lerSessao } from '@/lib/auth/sessao'
import { lerStore, publico, type UsuarioPublico } from '@/lib/operacao/store'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function usuarioDaSessao(): Promise<UsuarioPublico | null> {
  const jar = await cookies()
  const id = lerSessao(jar.get(COOKIE_SESSAO)?.value)
  if (!id) return null
  const store = await lerStore()
  const usuario = store.usuarios.find((item) => item.id === id)
  if (!usuario?.ativo) return null
  return publico(usuario)
}

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

export async function gravarSessao(userId: string) {
  const jar = await cookies()
  jar.set(COOKIE_SESSAO, emitirSessao(userId), {
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
}
