import { usuarioDaSessao } from '@/lib/auth/guard'
import { pode } from '@/lib/projetos/acesso'
import { projetoPorId } from '@/lib/projetos/store'

export async function POST(_pedido: Request, contexto: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioDaSessao()
  if (!usuario) return texto('Entre para baixar a planilha.', 401)
  const { id } = await contexto.params
  if (!/^[\w-]+$/.test(id)) return texto('Projeto não encontrado.', 404)

  const projeto = await projetoPorId(id, { valores: false })
  if (!projeto) return texto('Projeto não encontrado.', 404)
  if (!pode(usuario, projeto, 'ver')) return texto('Este projeto não está com você.', 403)
  if (projeto.status === 'concluido') return texto('Um projeto concluído não pode ser alterado.', 403)
  return texto('Baixar o resultado não está disponível nesta etapa.', 403)
}

function texto(mensagem: string, status: number) {
  return new Response(mensagem, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
