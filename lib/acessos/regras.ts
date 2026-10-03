export type DiretivaGrupo = 'administrador' | 'acesso_comum'

export type GrupoRegistro = {
  id: string
  nome: string
  diretiva: DiretivaGrupo | null
  sistema: boolean
  membros: string[]
}

export const GRUPO_ADMINISTRADORES = 'administradores'
export const GRUPO_ACESSO_COMUM = 'acesso-comum'
export const GRUPO_EXECUTOR = 'executor'

export function ehDiretiva(valor: string): valor is DiretivaGrupo {
  return valor === 'administrador' || valor === 'acesso_comum'
}

export function rotuloDiretiva(diretiva: DiretivaGrupo | null) {
  if (diretiva === 'administrador') return 'Administrador'
  if (diretiva === 'acesso_comum') return 'Acesso comum'
  return 'Nenhuma'
}

export function papelDosGrupos(grupos: readonly GrupoRegistro[], usuarioId: string) {
  const admin = grupos.some(
    (grupo) => grupo.diretiva === 'administrador' && grupo.membros.includes(usuarioId),
  )
  return admin ? 'administrador' : 'comum'
}

export function idDeNome(nome: string, usados: ReadonlySet<string>) {
  const base =
    nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || 'grupo'
  let id = base
  let n = 2
  while (usados.has(id)) {
    id = `${base}-${n}`
    n += 1
  }
  return id
}
