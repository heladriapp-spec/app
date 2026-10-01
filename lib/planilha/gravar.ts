import type { ItemCotacao } from '@/lib/planilha/cotacao'
import type { LinhaPlanilha, PlanilhaLida } from '@/lib/planilha/ler'
import { lerNumeroBR } from '@/lib/planilha/numeros'
import type { Lancamento } from '@/lib/projetos/tipos'
import { abrirPlanilha, type PastaPlanilha } from '@/lib/planilha/xml'
import { fecharZip } from '@/lib/planilha/zip'

/** Grava os valores no arquivo original e devolve o mesmo .xlsx, com as fórmulas intactas. */
export function aplicarPreenchimento(
  buf: Buffer,
  lida: PlanilhaLida,
  lancamentos: Record<string, Lancamento>,
): Buffer {
  const pasta = abrirPlanilha(buf)
  if (lida.formato === 'cotacao' && lida.cotacao) {
    aplicarCotacao(pasta, lida.cotacao.materiais, 'cotacao de materiais', lancamentos)
    aplicarCotacao(pasta, lida.cotacao.maoDeObra, 'mao de obra', lancamentos)
  } else {
    aplicarAnexo(pasta, lida.linhas, lancamentos)
  }
  const livro = pasta.arquivos.get('xl/workbook.xml')
  if (livro) pasta.arquivos.set('xl/workbook.xml', Buffer.from(marcarRecalculo(livro.toString('utf8'))))
  return fecharZip(pasta.arquivos)
}

function aplicarCotacao(
  pasta: PastaPlanilha,
  itens: ItemCotacao[],
  trechoAba: string,
  lancamentos: Record<string, Lancamento>,
) {
  const caminho = folha(pasta, trechoAba)
  if (!caminho || itens.length === 0) return
  let xml = pasta.arquivos.get(caminho)?.toString('utf8')
  if (!xml) return
  for (const item of itens) {
    const salvo = lancamentos[item.codigo]
    if (!salvo || !item.colunaValor) continue
    const unitario = lerNumeroBR(salvo.valor ?? '')
    if (unitario != null) {
      xml = escreverNumero(xml, `${item.colunaValor}${item.linha}`, unitario)
      const quantidade = lerNumeroBR(item.quantidade)
      if (item.colunaTotal && quantidade != null) {
        const total = Math.round((quantidade * unitario + Number.EPSILON) * 100) / 100
        xml = escreverNumero(xml, `${item.colunaTotal}${item.linha}`, total)
      }
    }
    if (item.temObservacao && item.colunaObservacao) {
      xml = escreverTexto(xml, `${item.colunaObservacao}${item.linha}`, salvo.observacao ?? '')
    }
  }
  pasta.arquivos.set(caminho, Buffer.from(xml))
}

function aplicarAnexo(
  pasta: PastaPlanilha,
  linhas: LinhaPlanilha[],
  lancamentos: Record<string, Lancamento>,
) {
  const caminho = pasta.abas[0]?.caminho
  if (!caminho) return
  let xml = pasta.arquivos.get(caminho)?.toString('utf8')
  if (!xml) return
  for (const linha of linhas) {
    if (linha.grupo) continue
    const salvo = lancamentos[String(linha.linha)]
    if (!salvo) continue
    xml = escreverSeNumero(xml, `E${linha.linha}`, salvo.quantidade)
    xml = escreverSeNumero(xml, `F${linha.linha}`, salvo.material)
    xml = escreverSeNumero(xml, `G${linha.linha}`, salvo.maoDeObra)
  }
  pasta.arquivos.set(caminho, Buffer.from(xml))
}

function escreverSeNumero(xml: string, ref: string, texto: string) {
  const numero = lerNumeroBR(texto)
  if (numero == null) return xml
  return escreverNumero(xml, ref, numero)
}

function folha(pasta: PastaPlanilha, trecho: string) {
  const alvo = normalizar(trecho)
  return pasta.abas.find((aba) => normalizar(aba.nome).includes(alvo))?.caminho ?? ''
}

function escreverNumero(xml: string, ref: string, valor: number) {
  const texto = numeroExcel(valor)
  return editarCelula(xml, ref, (abertura, miolo) => {
    if (miolo && /<f[\s>]/.test(miolo)) return atualizarCache(abertura, miolo, texto)
    const attrs = abertura.replace(/\st="[^"]*"/, '')
    return `<c${attrs} t="n"><v>${texto}</v></c>`
  })
}

function escreverTexto(xml: string, ref: string, texto: string) {
  const seguro = escapar(texto)
  return editarCelula(xml, ref, (abertura, miolo) => {
    if (miolo && /<f[\s>]/.test(miolo)) return `<c${abertura}>${miolo}</c>`
    const attrs = abertura.replace(/\st="[^"]*"/, '')
    return `<c${attrs} t="inlineStr"><is><t xml:space="preserve">${seguro}</t></is></c>`
  })
}

function atualizarCache(abertura: string, miolo: string, texto: string) {
  if (/<v[\s>]/.test(miolo)) {
    return `<c${abertura}>${miolo.replace(/<v[^>]*>[\s\S]*?<\/v>/, `<v>${texto}</v>`)}</c>`
  }
  return `<c${abertura}>${miolo}<v>${texto}</v></c>`
}

function editarCelula(
  xml: string,
  ref: string,
  produzir: (abertura: string, miolo: string | null) => string,
) {
  const re = new RegExp(
    `<c\\b([^>]*?\\sr="${ref}"[^>]*?)/>|<c\\b([^>]*?\\sr="${ref}"[^>]*?)>([\\s\\S]*?)</c>`,
  )
  const achou = re.exec(xml)
  if (!achou) return xml
  const abertura = achou[1] || achou[2] || ''
  const miolo = achou[1] ? null : (achou[3] ?? '')
  const novo = produzir(abertura, miolo)
  return xml.slice(0, achou.index) + novo + xml.slice(achou.index + achou[0].length)
}

function marcarRecalculo(xml: string) {
  if (xml.includes('fullCalcOnLoad=')) {
    return xml.replace(/fullCalcOnLoad="[^"]*"/, 'fullCalcOnLoad="1"')
  }
  if (xml.includes('<calcPr')) return xml.replace('<calcPr', '<calcPr fullCalcOnLoad="1"')
  return xml.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>')
}

function numeroExcel(valor: number) {
  return String(Math.round((valor + Number.EPSILON) * 1e8) / 1e8)
}

function escapar(texto: string) {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
