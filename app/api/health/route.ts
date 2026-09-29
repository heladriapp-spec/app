import { montarRelatorioSaude, serializarPublico } from '@/lib/saude/executar'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const dest = request.headers.get('sec-fetch-dest')
  const accept = request.headers.get('accept') ?? ''
  const querHtml =
    new URL(request.url).searchParams.get('formato') !== 'json' &&
    (dest === 'document' || (accept.includes('text/html') && !accept.includes('application/json')))

  if (querHtml) {
    return NextResponse.redirect(new URL('/saude', request.url), 302)
  }

  const relatorio = await montarRelatorioSaude()
  return Response.json(serializarPublico(relatorio), {
    status: relatorio.status === 'UNHEALTHY' ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
