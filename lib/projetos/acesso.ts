import type { StatusProjeto } from '@/lib/projetos/tipos'

export type AtorProjeto = {
  id: string
  login: string
  papel: string
}

export type AlvoProjeto = {
  criadoPor: string
  participantes: string[]
  status: StatusProjeto
  arquivoNome: string | null
  arquivoGeradoNome: string | null
}

export type AcaoProjeto =
  | 'ver'
  | 'ver_valores'
  | 'editar'
  | 'submeter'
  | 'excluir'
  | 'baixar_origem'
  | 'baixar_gerado'

export function ehAutor(usuario: { login: string }, projeto: { criadoPor: string }) {
  return projeto.criadoPor === usuario.login
}

/** A regra fica aqui. Esconder o botão não autoriza a rota. */
export function pode(usuario: AtorProjeto, projeto: AlvoProjeto, acao: AcaoProjeto) {
  const autor = ehAutor(usuario, projeto)
  const admin = usuario.papel === 'administrador'
  const participa = admin || projeto.participantes.includes(usuario.id)

  if (acao === 'ver') return participa
  if (acao === 'excluir') return projeto.status === 'em_edicao' && (autor || admin)
  if (acao === 'editar') return autor && projeto.status === 'em_edicao'
  if (acao === 'submeter') return autor && projeto.status === 'em_edicao' && Boolean(projeto.arquivoNome)
  if (acao === 'ver_valores') return autor && projeto.status === 'em_edicao'
  if (acao === 'baixar_origem') return autor && projeto.status === 'em_edicao' && Boolean(projeto.arquivoNome)
  if (acao === 'baixar_gerado') {
    return projeto.status === 'concluido' && Boolean(projeto.arquivoGeradoNome) && (autor || admin)
  }
  return false
}
