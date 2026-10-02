import { usuarioDaSessao } from '@/lib/auth/guard'
import { aplicarPreenchimento } from '@/lib/planilha/gravar'
import { lancamentosIguais } from '@/lib/projetos/lancamento'
import { lerLancamentosAnexo, lerLancamentosCotacao } from '@/lib/planilha/preenchimento'
import { alterarStore, registrarNo } from '@/lib/operacao/store'
import {
  alterarProjetos,
  apagarArquivoGerado,
  gravarArquivoGerado,
  lerArquivoDoProjeto,
  limparConclusao,
  nomeDeDownload,
  planilhaDoProjeto,
  projetoPorId,
} from '@/lib/projetos/store'
import type { Lancamento } from '@/lib/projetos/tipos'

export async function POST(pedido: Request, contexto: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioDaSessao()
  if (!usuario) return texto('Entre para baixar a planilha.', 401)
  const { id } = await contexto.params
  if (!/^[\w-]+$/.test(id)) return texto('Projeto não encontrado.', 404)

  const projeto = await projetoPorId(id)
  if (!projeto) return texto('Projeto não encontrado.', 404)
  const participa = usuario.papel === 'administrador' || projeto.participantes.includes(usuario.id)
  if (!participa) return texto('Este projeto não está com você.', 403)

  const lida = await planilhaDoProjeto(projeto).catch(() => null)
  if (!lida) return texto('Este projeto ainda não tem planilha.', 400)

  const formData = await pedido.formData()
  const lido =
    lida.formato === 'cotacao' && lida.cotacao
      ? lerLancamentosCotacao(formData, lida.cotacao)
      : lerLancamentosAnexo(formData, lida.linhas)
  if (!lido.ok) return texto(lido.erro, 400)

  const lancamentos: Record<string, Lancamento> = lido.lancamentos
  const concluir = formData.get('concluir') === '1'
  const reabriu =
    !concluir && projeto.status === 'concluido' && !lancamentosIguais(projeto.lancamentos, lancamentos)
  if (reabriu) await apagarArquivoGerado(id)
  await alterarProjetos((projetos) => {
    const atual = projetos.find((item) => item.id === id)
    if (!atual) return
    atual.lancamentos = lancamentos
    atual.atualizadoEm = new Date().toISOString()
    atual.atualizadoPor = usuario.login
    if (reabriu) {
      atual.status = 'em_preenchimento'
      limparConclusao(atual)
    }
  })

  let arquivo: Buffer
  try {
    arquivo = aplicarPreenchimento(await lerArquivoDoProjeto(id), lida, lancamentos)
  } catch {
    return texto('Não foi possível montar a planilha.', 500)
  }

  const nome = nomeDeDownload(projeto.arquivoNome)
  if (concluir) {
    try {
      await gravarArquivoGerado(id, arquivo)
    } catch {
      return texto('Não foi possível gravar a planilha gerada.', 500)
    }
    await alterarProjetos((projetos) => {
      const atual = projetos.find((item) => item.id === id)
      if (!atual) return
      atual.status = 'concluido'
      atual.arquivoGeradoNome = nome
      atual.concluidoEm = new Date().toISOString()
      atual.concluidoPor = usuario.login
      atual.atualizadoEm = atual.concluidoEm
      atual.atualizadoPor = usuario.login
    })
  }

  await alterarStore((store) => {
    registrarNo(store, {
      nivel: 'info',
      evento: concluir ? 'PROJECT_CONCLUDED' : 'PROJECT_DOWNLOADED',
      ator: usuario.login,
      mensagem: concluir
        ? `${usuario.login} concluiu “${projeto.nome}” e gerou a planilha.`
        : `${usuario.login} baixou a planilha preenchida de “${projeto.nome}”.`,
      detalhe: { projeto: id, arquivo: nome },
    })
  })
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
