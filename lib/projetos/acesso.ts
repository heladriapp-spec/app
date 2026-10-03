import type { StatusProjeto } from '@/lib/projetos/tipos'

export type AtorProjeto = {
  id: string
  login: string
  papel: string
  executor: boolean
}

export type AlvoProjeto = {
  criadoPor: string
  participantes: string[]
  status: StatusProjeto
  arquivoNome: string | null
  arquivoGeradoNome: string | null
  responsavelId: string | null
  previaLiberada: boolean
}

export type AcaoProjeto =
  | 'ver'
  | 'ver_valores'
  | 'editar'
  | 'submeter'
  | 'assumir'
  | 'concluir'
  | 'devolver'
  | 'liberar_previa'
  | 'recolher_previa'
  | 'excluir'
  | 'baixar_origem'
  | 'baixar_gerado'
  | 'ver_historico'
  | 'excluir_item'
  | 'restaurar'
  | 'gerir_participantes'

export function ehAutor(usuario: { login: string }, projeto: { criadoPor: string }) {
  return projeto.criadoPor === usuario.login
}

function ehResponsavel(usuario: { id: string }, projeto: { responsavelId: string | null }) {
  return projeto.responsavelId != null && projeto.responsavelId === usuario.id
}

function naFila(usuario: { executor: boolean }, projeto: AlvoProjeto) {
  return usuario.executor && projeto.status === 'em_execucao' && !projeto.responsavelId
}

/** A regra fica aqui. Esconder o botão não autoriza a rota. */
export function pode(usuario: AtorProjeto, projeto: AlvoProjeto, acao: AcaoProjeto) {
  const autor = ehAutor(usuario, projeto)
  const admin = usuario.papel === 'administrador'
  const responsavel = ehResponsavel(usuario, projeto)
  const participa = admin || projeto.participantes.includes(usuario.id) || responsavel
  const preenche =
    (autor && projeto.status === 'em_edicao') || (responsavel && projeto.status === 'em_execucao')

  if (acao === 'ver') return participa || naFila(usuario, projeto)
  if (acao === 'excluir') return projeto.status === 'em_edicao' && (autor || admin)
  if (acao === 'editar') return preenche
  if (acao === 'ver_valores') {
    return preenche || (autor && projeto.status === 'em_execucao' && projeto.previaLiberada)
  }
  if (acao === 'submeter') return autor && projeto.status === 'em_edicao' && Boolean(projeto.arquivoNome)
  if (acao === 'assumir') return naFila(usuario, projeto)
  if (acao === 'concluir') {
    return responsavel && projeto.status === 'em_execucao' && Boolean(projeto.arquivoNome)
  }
  if (acao === 'devolver') return responsavel && projeto.status === 'em_execucao'
  if (acao === 'liberar_previa') return responsavel && projeto.status === 'em_execucao' && !projeto.previaLiberada
  if (acao === 'recolher_previa') return responsavel && projeto.status === 'em_execucao' && projeto.previaLiberada
  if (acao === 'baixar_origem') return autor && projeto.status === 'em_edicao' && Boolean(projeto.arquivoNome)
  if (acao === 'baixar_gerado') {
    return (
      projeto.status === 'concluido' &&
      Boolean(projeto.arquivoGeradoNome) &&
      (autor || admin || responsavel)
    )
  }
  if (acao === 'ver_historico') return autor && projeto.status === 'em_edicao'
  if (acao === 'excluir_item' || acao === 'restaurar') return admin && autor && projeto.status === 'em_edicao'
  if (acao === 'gerir_participantes') return admin && projeto.status !== 'concluido'
  return false
}
