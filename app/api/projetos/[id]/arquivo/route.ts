import { usuarioDaSessao } from '@/lib/auth/guard'
import { pode } from '@/lib/projetos/acesso'
import { lerArquivoDoProjeto, lerArquivoGerado, nomeDeDownload, projetoParaArquivo } from '@/lib/projetos/store'

export async function GET(pedido: Request, contexto: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioDaSessao()
  if (!usuario) return texto('Entre para baixar a planilha.', 401)
  const { id } = await contexto.params
  if (!/^[\w-]+$/.test(id)) return texto('Projeto não encontrado.', 404)

  const projeto = await projetoParaArquivo(id)
  if (!projeto) return texto('Projeto não encontrado.', 404)
  if (!pode(usuario, projeto, 'ver')) return texto('Este projeto não está com você.', 403)

  const papel = new URL(pedido.url).searchParams.get('papel')
  if (papel !== 'origem' && papel !== 'gerado') return texto('Arquivo não encontrado.', 404)
  const acao = papel === 'origem' ? 'baixar_origem' : 'baixar_gerado'
  if (!pode(usuario, projeto, acao)) {
    return texto(
      papel === 'gerado'
        ? 'Baixar o resultado não está disponível nesta etapa.'
        : 'Este arquivo não está disponível nesta etapa.',
      403,
    )
  }

  const guardado = papel === 'origem' ? projeto.arquivoNome : projeto.arquivoGeradoNome
  if (!guardado) return texto('Este projeto ainda não tem esse arquivo.', 404)

  let arquivo: Buffer
  try {
    arquivo = papel === 'origem' ? await lerArquivoDoProjeto(id) : await lerArquivoGerado(id)
  } catch {
    return texto('Não foi possível ler o arquivo.', 500)
  }

  const nome = nomeDeDownload(guardado)
  return new Response(new Uint8Array(arquivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nome}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      'Cache-Control': 'no-store',
    },
  })
}

function texto(mensagem: string, status: number) {
  return new Response(mensagem, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
