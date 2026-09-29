import { abrirZip } from './zip'

export type Celula = { valor: string; formula: boolean }
export type Grade = Map<number, Map<string, Celula>>

export type AbaArquivo = { nome: string; caminho: string }

export type PastaPlanilha = {
  arquivos: Map<string, Buffer>
  textos: string[]
  abas: AbaArquivo[]
}

export function abrirPlanilha(buf: Buffer): PastaPlanilha {
  if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('Envie a planilha .xlsx do SESC.')
  }
  const arquivos = abrirZip(buf)
  return {
    arquivos,
    textos: lerTextos(arquivos.get('xl/sharedStrings.xml')),
    abas: listarAbas(arquivos),
  }
}

export function gradeDaAba(pasta: PastaPlanilha, caminho: string) {
  const folha = pasta.arquivos.get(caminho)
  if (!folha) return new Map() as Grade
  return lerGrade(folha.toString('utf8'), pasta.textos)
}

export function textoCelula(grade: Grade, linha: number, coluna: string) {
  return (grade.get(linha)?.get(coluna)?.valor ?? '').replaceAll('\n', ' ').trim()
}

export function linhasDaGrade(grade: Grade) {
  return [...grade.keys()].sort((a, b) => a - b)
}

function listarAbas(arquivos: Map<string, Buffer>): AbaArquivo[] {
  const livro = arquivos.get('xl/workbook.xml')?.toString('utf8') ?? ''
  const rels = arquivos.get('xl/_rels/workbook.xml.rels')?.toString('utf8') ?? ''
  const abas: AbaArquivo[] = []
  for (const bloco of livro.matchAll(/<sheet\b[^>]*>/g)) {
    const tag = bloco[0]
    const nome = decodificar(/name="([^"]*)"/.exec(tag)?.[1] ?? '')
    const id = /r:id="([^"]+)"/.exec(tag)?.[1]
    const rel = id ? new RegExp(`<Relationship\\b[^>]*Id="${id}"[^>]*>`).exec(rels)?.[0] : ''
    const alvo = /Target="([^"]+)"/.exec(rel ?? '')?.[1] ?? ''
    if (!nome || !alvo) continue
    const limpo = alvo.replace(/^\//, '').replace(/^\.\.\//, '')
    abas.push({ nome, caminho: limpo.startsWith('xl/') ? limpo : `xl/${limpo}` })
  }
  return abas
}

function lerTextos(xml: Buffer | undefined) {
  if (!xml) return []
  const bruto = xml.toString('utf8')
  const textos: string[] = []
  for (const bloco of bruto.split(/<si[\s>]/).slice(1)) {
    const pedacos = [...bloco.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((item) =>
      decodificar(item[1] ?? ''),
    )
    textos.push(pedacos.join(''))
  }
  return textos
}

function lerGrade(xml: string, textos: string[]): Grade {
  const grade: Grade = new Map()
  for (const bloco of xml.split(/<row[\s>]/).slice(1)) {
    const numero = Number(/r="(\d+)"/.exec(bloco)?.[1] ?? '')
    if (!numero) continue
    const celulas = new Map<string, Celula>()
    for (const celula of bloco.matchAll(/<c\b([^>]*?)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = celula[1] || celula[2] || ''
      const miolo = celula[3] ?? ''
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1]
      if (!ref) continue
      const tipo = /t="([^"]+)"/.exec(attrs)?.[1] ?? ''
      const valorBruto = /<v[^>]*>([\s\S]*?)<\/v>/.exec(miolo)?.[1] ?? ''
      const formula = /<f[\s>]/.test(miolo)
      if (tipo === 's') celulas.set(ref, { valor: textos[Number(valorBruto)] ?? '', formula })
      else if (tipo === 'inlineStr') {
        celulas.set(ref, {
          valor: [...miolo.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
            .map((item) => decodificar(item[1] ?? ''))
            .join(''),
          formula,
        })
      } else celulas.set(ref, { valor: decodificar(valorBruto), formula })
    }
    grade.set(numero, celulas)
  }
  return grade
}

function decodificar(texto: string) {
  return texto
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
}
