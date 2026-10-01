import { usuarioDaSessao } from '@/lib/auth/guard'
import { aplicarPreenchimento } from '@/lib/planilha/gravar'
import { lerLancamentosAnexo, lerLancamentosCotacao } from '@/lib/planilha/preenchimento'
import { alterarStore, registrarNo } from '@/lib/operacao/store'
import { alterarProjetos, lerArquivoDoProjeto, planilhaDoProjeto, projetoPorId } from '@/lib/projetos/store'
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
  await alterarProjetos((projetos) => {
    const atual = projetos.find((item) => item.id === id)
    if (!atual) return
    atual.lancamentos = lancamentos
    atual.atualizadoEm = new Date().toISOString()
    atual.atualizadoPor = usuario.login
  })

  let arquivo: Buffer
  try {
    arquivo = aplicarPreenchimento(await lerArquivoDoProjeto(id), lida, lancamentos)
  } catch {
    return texto('Não foi possível montar a planilha.', 500)
  }

  await alterarStore((store) => {
    registrarNo(store, {
      nivel: 'info',
      evento: 'PROJECT_DOWNLOADED',
      ator: usuario.login,
      mensagem: `${usuario.login} baixou a planilha preenchida de “${projeto.nome}”.`,
      detalhe: { projeto: id },
    })
  })

  const nome = nomeDoArquivo(projeto.arquivoNome)
  return new Response(new Uint8Array(arquivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nome}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      'Cache-Control': 'no-store',
    },
  })
}

function nomeDoArquivo(original: string | null) {
  const base = (original || 'planilha.xlsx').split(/[/\\]/).pop()?.replace(/["\r\n]/g, '') || 'planilha.xlsx'
  return base.toLowerCase().endsWith('.xlsx') ? base : `${base}.xlsx`
}

function texto(mensagem: string, status: number) {
  return new Response(mensagem, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
