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
  await pedir('POST', `/rest/v1/${tabela}`, linhas, 'resolution=merge-duplicates,return=minimal')
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

export async function enviarPlanilha(id: string, buf: Buffer) {
  if (!/^[\w-]+$/.test(id)) throw new Error('Identificador inválido ao gravar a planilha.')
  await pedir(
    'POST',
    `/storage/v1/object/${BUCKET}/${id}.xlsx`,
    buf,
    undefined,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    { 'x-upsert': 'true' },
  )
}

export async function baixarPlanilha(id: string) {
  if (!/^[\w-]+$/.test(id)) throw new Error('Identificador inválido ao ler a planilha.')
  const resposta = await pedir('GET', `/storage/v1/object/${BUCKET}/${id}.xlsx`)
  return Buffer.from(await resposta.arrayBuffer())
}

export async function removerPlanilha(id: string) {
  if (!/^[\w-]+$/.test(id)) return
  const resposta = await fetch(endereco(`/storage/v1/object/${BUCKET}/${id}.xlsx`), {
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
  if (!resposta.ok) throw await falha(resposta)
  await resposta.body?.cancel()
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

async function falha(resposta: Response) {
  await resposta.body?.cancel()
  return new Error(`Supabase respondeu ${resposta.status}.`)
}
