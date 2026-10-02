import 'server-only'

const BUCKET = 'planilhas'

export function supabaseConfigurado() {
  return Boolean(url() && chave())
}

export async function lerTabela<T>(tabela: string, busca = 'select=*'): Promise<T[]> {
  const resposta = await pedir('GET', `/rest/v1/${tabela}?${busca}`)
  return (await resposta.json()) as T[]
}

export async function gravarTabela(tabela: string, linhas: unknown[]) {
  if (linhas.length === 0) return
  let atual = linhas.map((linha) => ({ ...(linha as Record<string, unknown>) }))
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    try {
      await pedir('POST', `/rest/v1/${tabela}`, atual, 'resolution=merge-duplicates,return=minimal')
      return
    } catch (erro) {
      const coluna = colunaAusente(erro)
      if (!coluna || atual.some((linha) => linha[coluna] != null)) throw erro
      atual = atual.map((linha) => {
        const copia = { ...linha }
        delete copia[coluna]
        return copia
      })
    }
  }
  throw new Error('O Supabase recusou colunas que esta versão não conseguiu gravar.')
}

export async function apagarFora(tabela: string, coluna: string, ids: string[]) {
  if (ids.length === 0) {
    await pedir('DELETE', `/rest/v1/${tabela}?${coluna}=not.is.null`)
    return
  }
  for (const id of ids) {
    if (!/^[\w-]+$/.test(id)) throw new Error('Identificador inválido ao gravar no Supabase.')
  }
  const lista = ids.map((id) => `"${id}"`).join(',')
  await pedir('DELETE', `/rest/v1/${tabela}?${coluna}=not.in.(${lista})`)
}

export type PapelPlanilha = 'origem' | 'gerado'

export async function enviarPlanilha(id: string, papel: PapelPlanilha, buf: Buffer) {
  await pedir(
    'POST',
    `/storage/v1/object/${BUCKET}/${objetoPlanilha(id, papel)}`,
    buf,
    undefined,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    { 'x-upsert': 'true' },
  )
}

export async function baixarPlanilha(id: string, papel: PapelPlanilha) {
  const resposta = await pedir('GET', `/storage/v1/object/${BUCKET}/${objetoPlanilha(id, papel)}`)
  return Buffer.from(await resposta.arrayBuffer())
}

export async function removerPlanilha(id: string, papel: PapelPlanilha) {
  if (!/^[\w-]+$/.test(id)) return
  const resposta = await fetch(endereco(`/storage/v1/object/${BUCKET}/${objetoPlanilha(id, papel)}`), {
    method: 'DELETE',
    headers: cabecalhos(),
    cache: 'no-store',
    redirect: 'manual',
  })
  if (resposta.status >= 300 && resposta.status < 400) {
    throw new Error('O Supabase pediu um redirecionamento. A chave não foi enviada adiante.')
  }
  if (resposta.status === 404) {
    await resposta.body?.cancel()
    return
  }
  if (!resposta.ok) {
    const erro = await falha(resposta)
    if (/object not found/i.test(erro.message)) return
    throw erro
  }
  await resposta.body?.cancel()
}

function objetoPlanilha(id: string, papel: PapelPlanilha) {
  if (!/^[\w-]+$/.test(id)) throw new Error('Identificador inválido ao acessar a planilha.')
  return papel === 'origem' ? `${id}.xlsx` : `${id}.gerado.xlsx`
}

export async function pingUsuarios() {
  await lerTabela<{ id: string }>('usuarios', 'select=id&limit=1')
}

function url() {
  const bruto = process.env.SUPABASE_URL?.trim() ?? ''
  if (!bruto) return ''
  let lida: URL
  try {
    lida = new URL(bruto)
  } catch {
    return ''
  }
  if (lida.protocol !== 'https:' || !lida.hostname.endsWith('.supabase.co')) return ''
  return lida.origin
}

function chave() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''
}

function endereco(caminho: string) {
  const base = url()
  if (!base || !chave()) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não estão definidas.')
  return `${base}${caminho}`
}

function cabecalhos(contentType?: string, extra?: Record<string, string>) {
  return {
    apikey: chave(),
    Authorization: `Bearer ${chave()}`,
    ...(contentType ? { 'Content-Type': contentType } : {}),
    ...extra,
  }
}

async function pedir(
  method: string,
  caminho: string,
  body?: unknown,
  prefer?: string,
  contentType = 'application/json',
  extra?: Record<string, string>,
) {
  const binario = Buffer.isBuffer(body)
  const resposta = await fetch(endereco(caminho), {
    method,
    headers: cabecalhos(body === undefined ? undefined : contentType, {
      ...(prefer ? { Prefer: prefer } : {}),
      ...extra,
    }),
    body: body === undefined ? undefined : binario ? new Uint8Array(body) : JSON.stringify(body),
    cache: 'no-store',
    redirect: 'manual',
  })
  if (resposta.status >= 300 && resposta.status < 400) {
    throw new Error('O Supabase pediu um redirecionamento. A chave não foi enviada adiante.')
  }
  if (!resposta.ok) throw await falha(resposta)
  if (method !== 'GET') await resposta.body?.cancel()
  return resposta
}

function colunaAusente(erro: unknown) {
  const codigo = codigoDe(erro)
  if (codigo !== 'PGRST204' && codigo !== '42703') return null
  if (!erro || typeof erro !== 'object' || !('coluna' in erro)) return null
  const coluna = (erro as { coluna?: unknown }).coluna
  return typeof coluna === 'string' && /^[\w]+$/.test(coluna) ? coluna : null
}

function codigoDe(erro: unknown) {
  if (!erro || typeof erro !== 'object' || !('codigo' in erro)) return ''
  const codigo = (erro as { codigo?: unknown }).codigo
  return typeof codigo === 'string' ? codigo : ''
}

export function ehTabelaAusente(erro: unknown) {
  if (codigoDe(erro) === 'PGRST205') return true
  return erro instanceof Error && erro.message.includes('ainda não tem a tabela')
}

async function falha(resposta: Response) {
  const texto = await resposta.text().catch(() => '')
  let codigo = ''
  let detalhe = ''
  try {
    const json = JSON.parse(texto) as { code?: string; message?: string; error?: string; details?: string }
    codigo = json.code ?? ''
    detalhe = json.message || json.error || json.details || ''
  } catch {
    detalhe = texto.replace(/\s+/g, ' ').trim().slice(0, 180)
  }
  const coluna =
    /Could not find the '([\w]+)' column/.exec(detalhe)?.[1] ??
    /column "([\w]+)"/.exec(detalhe)?.[1] ??
    ''
  const erro = new Error(mensagemSupabase(resposta.status, codigo, coluna, detalhe)) as Error & {
    codigo?: string
    coluna?: string
  }
  if (codigo) erro.codigo = codigo
  if (coluna) erro.coluna = coluna
  return erro
}

function mensagemSupabase(status: number, codigo: string, coluna: string, detalhe: string) {
  if (codigo === 'PGRST204') {
    return coluna
      ? `O Supabase ainda não tem a coluna “${coluna}”.`
      : 'O Supabase ainda não tem uma coluna desta versão.'
  }
  if (codigo === 'PGRST205') return 'O Supabase ainda não tem a tabela desta versão.'
  if (codigo === '23514') return 'O Supabase recusou o status do projeto. Falta a atualização do banco.'
  const curto = detalhe.replace(/\s+/g, ' ').trim().slice(0, 160)
  if (curto && !/key|token|secret|bearer/i.test(curto)) return `Supabase respondeu ${status}: ${curto}`
  return `Supabase respondeu ${status}.`
}
