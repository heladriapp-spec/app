'use server'

import { ehDiretiva } from '@/lib/acessos/regras'
import { requireAdmin } from '@/lib/auth/guard'
import { alternarMembroGrupo, criarGrupoAcesso, excluirGrupoAcesso } from '@/lib/operacao/store'
import { redirect, unstable_rethrow } from 'next/navigation'

function voltar(destino: string, texto: string, ok = false): never {
  const chave = ok ? 'ok' : 'erro'
  const url = new URL(destino, 'http://local')
  url.searchParams.set(chave, texto)
  redirect(`${url.pathname}?${url.searchParams.toString()}`)
}

export async function criarGrupo(formData: FormData) {
  const admin = await requireAdmin()
  const nome = String(formData.get('nome') ?? '').trim()
  const diretiva = String(formData.get('diretiva') ?? '')
  if (!ehDiretiva(diretiva)) voltar('/administracao/grupos', 'Escolha a diretiva do grupo.')
  try {
    const erro = await criarGrupoAcesso(nome, diretiva, admin.login)
    if (erro) voltar('/administracao/grupos', erro)
  } catch (error) {
    unstable_rethrow(error)
    voltar('/administracao/grupos', 'Não foi possível criar o grupo.')
  }
  voltar('/administracao/grupos', 'Grupo criado.', true)
}

export async function excluirGrupo(formData: FormData) {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  try {
    const erro = await excluirGrupoAcesso(id, admin.login)
    if (erro) voltar(`/administracao/grupos/${id}`, erro)
  } catch (error) {
    unstable_rethrow(error)
    voltar(`/administracao/grupos/${id}`, 'Não foi possível excluir o grupo.')
  }
  voltar('/administracao/grupos', 'Grupo excluído.', true)
}

export async function mudarMembro(formData: FormData) {
  const admin = await requireAdmin()
  const grupoId = String(formData.get('grupoId') ?? '')
  const usuarioId = String(formData.get('usuarioId') ?? '')
  const incluir = String(formData.get('incluir') ?? '') === 'sim'
  const q = String(formData.get('q') ?? '')
  const destino = `/administracao/grupos/${grupoId}${q ? `?q=${encodeURIComponent(q)}` : ''}`
  try {
    const erro = await alternarMembroGrupo(grupoId, usuarioId, incluir, admin.login)
    if (erro) voltar(destino, erro)
  } catch (error) {
    unstable_rethrow(error)
    voltar(destino, 'Não foi possível alterar o grupo.')
  }
  voltar(destino, incluir ? 'Usuário incluído no grupo.' : 'Usuário tirado do grupo.', true)
}
