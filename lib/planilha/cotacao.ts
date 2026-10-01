import { numeroPlanilhaParaTela } from './numeros'
import {
  gradeDaAba,
  linhasDaGrade,
  textoCelula,
  type AbaArquivo,
  type Grade,
  type PastaPlanilha,
} from './xml'

export type ItemCotacao = {
  codigo: string
  linha: number
  grupo: string
  titulo: string
  detalhe: string
  quantidade: string
  unidade: string
  valor: string
  status: string
  local: string
  observacao: string
  temObservacao: boolean
  rotuloValor: string
  colunaValor: string
  colunaTotal: string
  colunaObservacao: string
}

export type FaseCronograma = {
  codigo: string
  fase: string
  inicio: string
  fim: string
  duracao: string
  equipe: string
  objetivo: string
}

export type CotacaoLida = {
  titulo: string
  subtitulo: string
  orientacoes: string[]
  preenchimento: string
  legenda: { status: string; texto: string }[]
  notaPendencias: string
  materiais: ItemCotacao[]
  maoDeObra: ItemCotacao[]
  cronogramaTitulo: string
  cronogramaIntro: string
  fases: FaseCronograma[]
  premissas: string[]
}

const CODIGO = /^[A-Z]{2,}-\d+[A-Z0-9]*$/

export function ehCotacao(abas: AbaArquivo[]) {
  return abas.some((aba) => normalizar(aba.nome).includes('cotacao de materiais'))
}

export function lerCotacao(pasta: PastaPlanilha): CotacaoLida {
  const instrucoes = gradeNome(pasta, 'instruc')
  const materiais = gradeNome(pasta, 'cotacao de materiais')
  const mao = gradeNome(pasta, 'mao de obra')
  const cronograma = gradeNome(pasta, 'cronograma')
  const dashboard = gradeNome(pasta, 'dashboard')
  if (!materiais && !mao) {
    throw new Error('Não encontrei itens para preencher nesta planilha.')
  }

  const titulo = instrucoes ? primeiroTexto(instrucoes, 1) : 'Cotação'
  const subtitulo = instrucoes ? textoQueContem(instrucoes, 'planilha de') : ''
  return {
    titulo,
    subtitulo,
    orientacoes: instrucoes ? orientacoesDe(instrucoes) : [],
    preenchimento: instrucoes ? preenchimentoDe(instrucoes) : '',
    legenda: instrucoes ? legendaDe(instrucoes) : [],
    notaPendencias: dashboard ? notaDe(dashboard) : '',
    materiais: materiais ? itensDe(materiais, 'materiais') : [],
    maoDeObra: mao ? itensDe(mao, 'mao') : [],
    cronogramaTitulo: cronograma ? primeiroTexto(cronograma, 1) : '',
    cronogramaIntro: cronograma ? introDe(cronograma) : '',
    fases: cronograma ? fasesDe(cronograma) : [],
    premissas: cronograma ? premissasDe(cronograma) : [],
  }
}

function gradeNome(pasta: PastaPlanilha, trecho: string) {
  const aba = pasta.abas.find((item) => normalizar(item.nome).includes(trecho))
  if (!aba) return null
  return gradeDaAba(pasta, aba.caminho)
}

function itensDe(grade: Grade, tipo: 'materiais' | 'mao') {
  const cabecalho = acharCabecalho(grade)
  if (!cabecalho) return []
  const coluna = colunas(cabecalho.celulas)
  const item = coluna('item')
  const grupo = coluna(tipo === 'materiais' ? 'disciplina' : 'categoria')
  const titulo = coluna(tipo === 'materiais' ? 'material' : 'categoria')
  const detalhe = coluna('especific')
  const quantidade = coluna('quantidade')
  const unidade = coluna('unidade')
  const valor = coluna(tipo === 'materiais' ? 'custo unit' : 'valor unit')
  const status = coluna('status')
  const local = coluna('aplicacao')
  const observacao = coluna('observ')
  const total = coluna('custo total')
  const disciplinaCol = coluna('disciplina')
  if (!item || !valor) return []

  const itens: ItemCotacao[] = []
  const vistos = new Set<string>()
  for (const numero of linhasDaGrade(grade)) {
    if (numero <= cabecalho.linha) continue
    const codigo = textoCelula(grade, numero, item)
    if (!CODIGO.test(codigo)) continue
    const nome = textoCelula(grade, numero, titulo || grupo)
    if (!nome) continue
    let chave = codigo
    if (vistos.has(chave)) chave = `${codigo}:${numero}`
    vistos.add(chave)
    const categoria = textoCelula(grade, numero, grupo)
    const disciplina = disciplinaCol ? textoCelula(grade, numero, disciplinaCol) : ''
    itens.push({
      codigo: chave,
      linha: numero,
      grupo:
        tipo === 'materiais' ? categoria || 'Materiais' : disciplina || grupoMao(codigo),
      titulo: nome,
      detalhe: detalhe ? textoCelula(grade, numero, detalhe) : '',
      quantidade: quantidade ? numeroPlanilhaParaTela(textoCelula(grade, numero, quantidade)) : '',
      unidade: unidade ? textoCelula(grade, numero, unidade) : '',
      valor: numeroPlanilhaParaTela(textoCelula(grade, numero, valor)),
      status: status ? textoCelula(grade, numero, status) : '',
      local: local ? textoCelula(grade, numero, local) : '',
      observacao: observacao ? textoCelula(grade, numero, observacao) : '',
      temObservacao: Boolean(observacao),
      rotuloValor: tipo === 'materiais' ? 'Custo unitário (R$)' : 'Valor unitário (R$)',
      colunaValor: valor,
      colunaTotal: total,
      colunaObservacao: observacao,
    })
  }
  return itens
}

function grupoMao(codigo: string) {
  if (codigo.startsWith('LOG')) return 'Logística'
  if (codigo.startsWith('ENG')) return 'Responsabilidade técnica'
  return 'Mão de obra e serviços'
}

function acharCabecalho(grade: Grade) {
  for (const numero of linhasDaGrade(grade)) {
    const celulas = grade.get(numero)
    if (!celulas) continue
    const item = [...celulas.values()].find((celula) => normalizar(celula.valor) === 'item')
    if (item) return { linha: numero, celulas }
  }
  return null
}

function colunas(cabecalho: Map<string, { valor: string }>) {
  const pares = [...cabecalho.entries()].map(
    ([coluna, celula]) => [normalizar(celula.valor), coluna] as const,
  )
  return (trecho: string) => {
    const alvo = normalizar(trecho)
    return (
      pares.find(([rotulo]) => rotulo === alvo)?.[1] ??
      pares.find(([rotulo]) => rotulo.includes(alvo))?.[1] ??
      ''
    )
  }
}

function orientacoesDe(grade: Grade) {
  const textos: string[] = []
  for (const numero of linhasDaGrade(grade)) {
    const texto = textoCelula(grade, numero, 'A')
    if (/^\d+\.\s+/.test(texto)) textos.push(texto.replace(/^\d+\.\s+/, ''))
  }
  return textos
}

function preenchimentoDe(grade: Grade) {
  for (const numero of linhasDaGrade(grade)) {
    if (normalizar(textoCelula(grade, numero, 'A')).includes('legenda de preenchimento')) {
      return textoCelula(grade, numero, 'B')
    }
  }
  return ''
}

function legendaDe(grade: Grade) {
  const linhas = linhasDaGrade(grade)
  const inicio = linhas.find((numero) => {
    const status = normalizar(textoCelula(grade, numero, 'A'))
    const descricao = normalizar(textoCelula(grade, numero, 'B'))
    return status === 'status' && descricao.includes('descri')
  })
  if (!inicio) return []
  const legenda: { status: string; texto: string }[] = []
  for (const numero of linhas) {
    if (numero <= inicio) continue
    const status = textoCelula(grade, numero, 'A')
    const texto = textoCelula(grade, numero, 'B')
    if (!status || !texto) break
    if (status.length > 24) break
    legenda.push({ status, texto })
  }
  return legenda
}

function notaDe(grade: Grade) {
  let nota = ''
  for (const numero of linhasDaGrade(grade)) {
    const celulas = grade.get(numero)
    if (!celulas) continue
    for (const celula of celulas.values()) {
      if (celula.formula) continue
      const texto = celula.valor.replaceAll('\n', ' ').trim()
      if (normalizar(texto).includes('itens pendentes') && texto.length > nota.length) nota = texto
    }
  }
  return nota
}

function introDe(grade: Grade) {
  const cabecalho = acharCabecalhoFase(grade)?.linha ?? 99
  for (const numero of linhasDaGrade(grade)) {
    if (numero >= cabecalho) break
    const texto = textoCelula(grade, numero, 'A')
    if (texto.length > 40 && !normalizar(texto).startsWith('cronograma')) return texto
  }
  return ''
}

function fasesDe(grade: Grade) {
  const cabecalho = acharCabecalhoFase(grade)
  if (!cabecalho) return []
  const coluna = colunas(cabecalho.celulas)
  const codigo = coluna('codigo')
  const fase = coluna('fase')
  const inicio = coluna('inicio')
  const fim = coluna('fim')
  const duracao = coluna('duracao')
  const equipe = coluna('equipe')
  const objetivo = coluna('objetivo')
  if (!fase) return []
  const fases: FaseCronograma[] = []
  for (const numero of linhasDaGrade(grade)) {
    if (numero <= cabecalho.linha) continue
    const id = codigo ? textoCelula(grade, numero, codigo) : ''
    const nome = textoCelula(grade, numero, fase)
    if (!id && !nome) continue
    if (!codigoDeFase(id)) break
    fases.push({
      codigo: id,
      fase: nome,
      inicio: inicio ? dataExcel(textoCelula(grade, numero, inicio)) : '',
      fim: fim ? dataExcel(textoCelula(grade, numero, fim)) : '',
      duracao: duracao ? textoCelula(grade, numero, duracao) : '',
      equipe: equipe ? textoCelula(grade, numero, equipe) : '',
      objetivo: objetivo ? textoCelula(grade, numero, objetivo) : '',
    })
  }
  return fases
}

function acharCabecalhoFase(grade: Grade) {
  for (const numero of linhasDaGrade(grade)) {
    const celulas = grade.get(numero)
    if (!celulas) continue
    const rotulos = [...celulas.values()].map((celula) => normalizar(celula.valor))
    if (rotulos.includes('fase') && rotulos.includes('codigo')) return { linha: numero, celulas }
  }
  return null
}

function codigoDeFase(codigo: string) {
  return CODIGO.test(codigo) || codigo === 'MARCO'
}

function premissasDe(grade: Grade) {
  const cabecalho = acharCabecalhoFase(grade)?.linha ?? 0
  const textos: string[] = []
  for (const numero of linhasDaGrade(grade)) {
    if (numero <= cabecalho) continue
    const texto = textoCelula(grade, numero, 'A')
    if (texto.length < 80) continue
    textos.push(texto)
  }
  return textos
}

function primeiroTexto(grade: Grade, linha: number) {
  return textoCelula(grade, linha, 'A')
}

function textoQueContem(grade: Grade, trecho: string) {
  const alvo = normalizar(trecho)
  for (const numero of linhasDaGrade(grade)) {
    const texto = textoCelula(grade, numero, 'A')
    if (normalizar(texto).includes(alvo)) return texto
  }
  return ''
}

function dataExcel(bruto: string) {
  const texto = bruto.trim()
  if (!/^\d+(\.\d+)?$/.test(texto)) return texto
  const serial = Number(texto)
  if (serial < 20000 || serial > 80000) return texto
  const data = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000)
  const dia = String(data.getUTCDate()).padStart(2, '0')
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${data.getUTCFullYear()}`
}

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
