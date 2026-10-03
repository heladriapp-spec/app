import {
  aplicarEstado,
  diferencas,
  estadoDe,
  type EstadoPlanilha,
  type Mudanca,
} from '@/lib/projetos/estado'
import { listarEventosProjeto, registrarEventoProjeto } from '@/lib/projetos/eventos'
import type { Lancamento } from '@/lib/projetos/tipos'
import { ehTabelaAusente, inserirLinha, lerTabela, supabaseConfigurado } from '@/lib/supabase/nuvem'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const PASTA = path.join(process.cwd(), 'data', 'projetos')
const ARQUIVO = path.join(PASTA, 'versoes.json')

type VersaoGuardada = {
  id: string
  projetoId: string
  numero: number
  em: string
  ator: string
  estado: EstadoPlanilha
}

export type VersaoVisivel = {
  numero: number
  em: string
  ator: string
  atual: boolean
  mudancas: string[]
}

export type EntradaParticipante = {
  em: string
  ator: string
  login: string
  incluido: boolean
}

let fila: Promise<unknown> = Promise.resolve()

export async function registrarVersao(input: {
  projetoId: string
  ator: string
  antes: Record<string, Lancamento>
  depois: Record<string, Lancamento>
  rotulos: Record<string, string>
  restauradaDe?: number
}) {
  const mudancas = diferencas(input.antes, input.depois, input.rotulos)
  if (mudancas.length === 0 && input.restauradaDe == null) return null
  const numero = (await ultimoNumero(input.projetoId)) + 1
  const versao: VersaoGuardada = {
    id: crypto.randomUUID(),
    projetoId: input.projetoId,
    numero,
    em: new Date().toISOString(),
    ator: input.ator,
    estado: estadoDe(input.depois),
  }
  await guardar(versao)
  if (input.restauradaDe != null) {
    await registrarEventoProjeto({
      projetoId: input.projetoId,
      tipo: 'restaurou',
      ator: input.ator,
      detalhe: { versao: numero, origem: input.restauradaDe },
    })
  }
  for (const mudanca of mudancas) {
    await registrarEventoProjeto({
      projetoId: input.projetoId,
      tipo: mudanca.tipo,
      ator: input.ator,
      detalhe: detalheDaMudanca(mudanca, numero),
    })
  }
  return numero
}

export async function listarVersoesVisiveis(projetoId: string): Promise<VersaoVisivel[]> {
  const [versoes, eventos] = await Promise.all([
    listarVersoes(projetoId, false),
    listarEventosProjeto(projetoId),
  ])
  const maior = versoes.reduce((acc, item) => Math.max(acc, item.numero), 0)
  return [...versoes]
    .sort((a, b) => b.numero - a.numero)
    .map((versao) => ({
      numero: versao.numero,
      em: versao.em,
      ator: versao.ator,
      atual: versao.numero === maior,
      mudancas: eventos
        .filter((evento) => evento.detalhe.versao === versao.numero)
        .map((evento) => {
          if (evento.tipo === 'restaurou') {
            return `Voltou ao estado da versão ${evento.detalhe.origem ?? ''}.`
          }
          if (evento.tipo === 'excluiu_item') return `${evento.detalhe.rotulo || evento.detalhe.item} saiu do trabalho.`
          if (evento.tipo === 'reincluiu_item') {
            return `${evento.detalhe.rotulo || evento.detalhe.item} voltou ao trabalho.`
          }
          if (evento.tipo === 'campo') {
            const anterior = evento.detalhe.anterior || 'vazio'
            const novo = evento.detalhe.novo || 'vazio'
            const quem = evento.detalhe.rotulo || evento.detalhe.item || 'Item'
            return `${quem} · ${evento.detalhe.campo}: ${anterior} → ${novo}`
          }
          return ''
        })
        .filter(Boolean),
    }))
}

export async function estadoDaVersao(projetoId: string, numero: number) {
  if (!Number.isInteger(numero) || numero < 1) return null
  const versoes = await listarVersoes(projetoId, true, numero)
  return versoes.find((item) => item.numero === numero) ?? null
}

export function lancamentosRestaurados(
  atual: Record<string, Lancamento>,
  estado: EstadoPlanilha,
) {
  return aplicarEstado(atual, estado)
}

export async function listarEntradasParticipante(projetoId: string): Promise<EntradaParticipante[]> {
  const eventos = await listarEventosProjeto(projetoId)
  return eventos
    .filter((evento) => evento.tipo === 'participante_incluido' || evento.tipo === 'participante_removido')
    .map((evento) => ({
      em: evento.em,
      ator: evento.ator,
      login: evento.detalhe.login || 'conta',
      incluido: evento.tipo === 'participante_incluido',
    }))
    .reverse()
}

export async function apagarVersoesLocais(projetoId: string) {
  if (supabaseConfigurado() || !/^[\w-]+$/.test(projetoId)) return
  await enfileirar(async () => {
    const lista = (await ler()).filter((item) => item.projetoId !== projetoId)
    await mkdir(PASTA, { recursive: true })
    await writeFile(ARQUIVO, JSON.stringify({ versoes: lista }), { mode: 0o600 })
  })
}

function detalheDaMudanca(mudanca: Mudanca, versao: number) {
  if (mudanca.tipo === 'campo') {
    return {
      versao,
      item: mudanca.item,
      rotulo: mudanca.rotulo,
      campo: mudanca.campo,
      anterior: encurtar(mudanca.anterior),
      novo: encurtar(mudanca.novo),
    }
  }
  return { versao, item: mudanca.item, rotulo: mudanca.rotulo }
}

async function ultimoNumero(projetoId: string) {
  const versoes = await listarVersoes(projetoId, false)
  return versoes.reduce((acc, item) => Math.max(acc, item.numero), 0)
}

async function listarVersoes(
  projetoId: string,
  comEstado: boolean,
  numero?: number,
): Promise<VersaoGuardada[]> {
  if (!/^[\w-]+$/.test(projetoId)) return []
  if (!supabaseConfigurado()) {
    const lista = (await ler()).filter((item) => item.projetoId === projetoId)
    return numero == null ? lista : lista.filter((item) => item.numero === numero)
  }
  const colunas = comEstado ? 'id,projeto_id,numero,em,ator,estado' : 'id,projeto_id,numero,em,ator'
  const filtroNumero = numero == null ? '' : `&numero=eq.${numero}`
  try {
    const linhas = await lerTabela<{
      id: string
      projeto_id: string
      numero: number
      em: string
      ator: string
      estado?: EstadoPlanilha | null
    }>(
      'projeto_versoes',
      `select=${colunas}&projeto_id=eq.${projetoId}${filtroNumero}&order=numero.asc`,
    )
    return linhas.map((item) => ({
      id: item.id,
      projetoId: item.projeto_id,
      numero: item.numero,
      em: item.em,
      ator: item.ator,
      estado: item.estado ?? {},
    }))
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro
    return []
  }
}

async function guardar(versao: VersaoGuardada) {
  if (!supabaseConfigurado()) {
    await enfileirar(async () => {
      const lista = await ler()
      lista.push(versao)
      await mkdir(PASTA, { recursive: true })
      await writeFile(ARQUIVO, JSON.stringify({ versoes: lista }), { mode: 0o600 })
    })
    return
  }
  await inserirLinha(
    'projeto_versoes',
    {
      id: versao.id,
      projeto_id: versao.projetoId,
      numero: versao.numero,
      em: versao.em,
      ator: versao.ator,
      estado: versao.estado,
    },
    'id',
  )
}

async function ler() {
  try {
    const bruto = await readFile(ARQUIVO, 'utf8')
    const json = JSON.parse(bruto) as { versoes?: VersaoGuardada[] }
    return json.versoes ?? []
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw erro
  }
}

function enfileirar<T>(fn: () => Promise<T>) {
  const exec = fila.then(fn)
  fila = exec.then(
    () => undefined,
    () => undefined,
  )
  return exec
}

function encurtar(valor: string) {
  return valor.length > 500 ? `${valor.slice(0, 497)}…` : valor
}
