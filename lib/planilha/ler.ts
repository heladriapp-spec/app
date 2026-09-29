import { ehCotacao, lerCotacao, type CotacaoLida } from './cotacao'
import { numeroPlanilhaParaTela } from './numeros'
import { abrirPlanilha, gradeDaAba, linhasDaGrade, textoCelula, type Grade } from './xml'

export type { CotacaoLida, FaseCronograma, ItemCotacao } from './cotacao'

export type CapaPlanilha = {
  aba: string
  processo: string
  titulo: string
  evento: string
  unidade: string
}

export type LinhaPlanilha = {
  linha: number
  item: string
  codigo: string
  descricao: string
  unidade: string
  quantidade: string
  material: string
  maoDeObra: string
  grupo: boolean
}

export type PlanilhaLida = {
  formato: 'anexo' | 'cotacao'
  capa: CapaPlanilha
  linhas: LinhaPlanilha[]
  cotacao: CotacaoLida | null
}

const CODIGO = /^[A-Z](\.\d+)*$/

export function lerPlanilha(buf: Buffer): PlanilhaLida {
  const pasta = abrirPlanilha(buf)
  if (ehCotacao(pasta.abas)) {
    const cotacao = lerCotacao(pasta)
    if (cotacao.materiais.length + cotacao.maoDeObra.length === 0) {
      throw new Error('Não encontrei itens para preencher nesta planilha.')
    }
    return {
      formato: 'cotacao',
      capa: {
        aba: 'Cotação',
        processo: '',
        titulo: cotacao.titulo,
        evento: cotacao.subtitulo,
        unidade: '',
      },
      linhas: [],
      cotacao,
    }
  }

  const primeira = pasta.abas[0]
  if (!primeira) throw new Error('A planilha não tem aba para ler.')
  const grade = gradeDaAba(pasta, primeira.caminho)
  const linhas = montarLinhas(grade)
  if (linhas.length === 0) {
    throw new Error('Não encontrei itens com código nesta planilha.')
  }
  return { formato: 'anexo', capa: capaDe(grade, primeira.nome), linhas, cotacao: null }
}

function montarLinhas(grade: Grade) {
  const linhas: LinhaPlanilha[] = []
  for (const numero of linhasDaGrade(grade)) {
    const codigo = textoCelula(grade, numero, 'B')
    if (!CODIGO.test(codigo)) continue
    const unidade = textoCelula(grade, numero, 'D')
    const material = precoDaCelula(textoCelula(grade, numero, 'F'))
    const maoDeObra = precoDaCelula(textoCelula(grade, numero, 'G'))
    linhas.push({
      linha: numero,
      item: textoCelula(grade, numero, 'A'),
      codigo,
      descricao: textoCelula(grade, numero, 'C'),
      unidade,
      quantidade: numeroPlanilhaParaTela(textoCelula(grade, numero, 'E')),
      material,
      maoDeObra,
      grupo: unidade.length === 0,
    })
  }
  return linhas
}

/** Zero gravado no arquivo, sem digitação, aparece vazio na tela. */
function precoDaCelula(bruto: string) {
  const texto = bruto.trim().replace(',', '.')
  if (!texto || texto === '0' || texto === '0.0') return ''
  return numeroPlanilhaParaTela(bruto)
}

function capaDe(grade: Grade, aba: string): CapaPlanilha {
  let processo = ''
  let titulo = ''
  let evento = ''
  let unidade = ''
  for (const numero of linhasDaGrade(grade)) {
    if (numero > 12) break
    const e = textoCelula(grade, numero, 'E')
    const f = textoCelula(grade, numero, 'F')
    if (!processo && /^PE\s*\d+/i.test(e)) processo = e
    if (!titulo && /anexo/i.test(e)) titulo = e
    if (/^EVENTO:?$/i.test(e)) evento = f
    if (/^UNIDADE:?$/i.test(e)) unidade = f
  }
  return { aba, processo, titulo, evento, unidade }
}
