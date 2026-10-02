import type { CotacaoLida } from '@/lib/planilha/cotacao'
import { lerExtras, valorExportado } from '@/lib/planilha/extra'
import { canonizarStatus, chaveStatus, opcoesStatus } from '@/lib/planilha/status'
import type { LinhaPlanilha } from '@/lib/planilha/ler'
import { lerNumeroBR } from '@/lib/planilha/numeros'
import type { Lancamento } from '@/lib/projetos/tipos'

export function lerLancamentosCotacao(
  formData: FormData,
  cotacao: CotacaoLida,
): { ok: true; lancamentos: Record<string, Lancamento> } | { ok: false; erro: string } {
  const servicos = new Set(cotacao.maoDeObra.map((item) => item.codigo))
  const opcoes = opcoesStatus(cotacao.legenda)
  const lancamentos: Record<string, Lancamento> = {}
  for (const item of [...cotacao.materiais, ...cotacao.maoDeObra]) {
    const valor = String(formData.get(`valor:${item.codigo}`) ?? '').trim()
    const observacao = item.temObservacao ? String(formData.get(`obs:${item.codigo}`) ?? '').trim() : ''
    if (valor && lerNumeroBR(valor) == null) {
      return { ok: false, erro: `O valor de ${item.codigo} precisa ser um número. Exemplo: 11,8.` }
    }
    if (observacao.length > 2000) {
      return { ok: false, erro: `A observação de ${item.codigo} passa de 2000 caracteres.` }
    }
    const escolhido = String(formData.get(`status:${item.codigo}`) ?? '').trim()
    const canonico = canonizarStatus(escolhido, opcoes)
    if (escolhido && !canonico && chaveStatus(escolhido) !== chaveStatus(item.status)) {
      return { ok: false, erro: `O status de ${item.codigo} não está na legenda.` }
    }
    const lancamento: Lancamento = {
      quantidade: '',
      material: '',
      maoDeObra: '',
      valor,
      observacao,
      status: canonico || item.status,
    }
    if (servicos.has(item.codigo)) {
      const extras = lerExtras(String(formData.get(`extras:${item.codigo}`) ?? ''))
      if (!extras.ok) {
        return { ok: false, erro: `O extra de ${item.codigo} não pôde ser lido.` }
      }
      if (extras.extras.length > 0) {
        const valorBase = String(formData.get(`base:${item.codigo}`) ?? '').trim()
        const base = lerNumeroBR(valorBase)
        if (base == null) {
          return { ok: false, erro: `O valor base de ${item.codigo} precisa ser um número.` }
        }
        lancamento.valorBase = valorBase
        lancamento.extras = extras.extras
        lancamento.valor = valorExportado(base, extras.extras)
      }
    }
    lancamentos[item.codigo] = lancamento
  }
  return { ok: true, lancamentos }
}

export function lerLancamentosAnexo(
  formData: FormData,
  linhas: LinhaPlanilha[],
): { ok: true; lancamentos: Record<string, Lancamento> } | { ok: false; erro: string } {
  const lancamentos: Record<string, Lancamento> = {}
  for (const linha of linhas) {
    if (linha.grupo) continue
    const chave = String(linha.linha)
    const quantidade = String(formData.get(`qtde:${chave}`) ?? '').trim()
    const material = String(formData.get(`material:${chave}`) ?? '').trim()
    const maoDeObra = String(formData.get(`mao:${chave}`) ?? '').trim()
    if (
      (quantidade && lerNumeroBR(quantidade) == null) ||
      (material && lerNumeroBR(material) == null) ||
      (maoDeObra && lerNumeroBR(maoDeObra) == null)
    ) {
      return { ok: false, erro: 'Use número, com vírgula nos decimais. Exemplo: 11,8.' }
    }
    lancamentos[chave] = { quantidade, material, maoDeObra }
  }
  return { ok: true, lancamentos }
}
