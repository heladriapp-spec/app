'use client'

import { cn } from '@/lib/utils'
import { CircleCheck, CircleX, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'

type Fase = 'oculto' | 'processando' | 'concluida' | 'saindo' | 'encerrada' | 'bloqueada' | 'desativada'

const TEXTO: Record<Exclude<Fase, 'oculto'>, string> = {
  processando: 'Processando',
  concluida: 'Ação concluída',
  saindo: 'Encerrando sessão',
  encerrada: 'Sessão encerrada',
  bloqueada: 'Usuário bloqueado',
  desativada: 'Conta desativada',
}

const RECUSA_DE_CONTA: Record<string, 'bloqueada' | 'desativada'> = {
  'Usuário bloqueado': 'bloqueada',
  'Conta desativada': 'desativada',
}

type Modo = 'acao' | 'sair' | 'silencioso'

let instalado = false
let modo: Modo = 'acao'
let ocupado = false
let ouvinte: ((fase: Fase) => void) | null = null

function publicar(fase: Fase) {
  ocupado = fase === 'processando' || fase === 'saindo'
  ouvinte?.(fase)
}

function temCabecalho(input: RequestInfo | URL, init: RequestInit | undefined, nome: string) {
  if (new Headers(init?.headers).has(nome)) return true
  return input instanceof Request && input.headers.has(nome)
}

function mensagemDeErro(redirecionamento: string) {
  const caminho = redirecionamento.split(';')[0]
  if (!caminho) return ''
  try {
    return new URL(caminho, window.location.origin).searchParams.get('erro') ?? ''
  } catch {
    const bruto = /(?:^|[?&])erro=([^&;]*)/.exec(caminho)?.[1] ?? ''
    try {
      return decodeURIComponent(bruto.replace(/\+/g, ' '))
    } catch {
      return bruto
    }
  }
}

function instalar() {
  if (instalado) return
  instalado = true
  const original = window.fetch.bind(window)

  document.addEventListener(
    'submit',
    (evento) => {
      const form = evento.target
      if (!(form instanceof HTMLFormElement)) return
      const clicado = evento.submitter instanceof HTMLElement ? evento.submitter.dataset.aviso : ''
      const aviso = clicado || form.dataset.aviso
      modo = aviso === 'sair' ? 'sair' : aviso === 'silencioso' ? 'silencioso' : 'acao'
    },
    true,
  )

  window.addEventListener('keydown', (evento) => {
    const esc = evento.key === 'Escape' || evento.code === 'Escape'
    if (!esc || !evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.repeat) {
      return
    }
    const form = document.querySelector<HTMLFormElement>('form[data-aviso="sair"]')
    if (!form || ocupado) return
    evento.preventDefault()
    form.requestSubmit()
  })

  window.fetch = async (input, init) => {
    const acao = temCabecalho(input, init, 'next-action')
    if (!acao) return original(input, init)

    if (acao && modo === 'silencioso') {
      try {
        return await original(input, init)
      } finally {
        modo = 'acao'
      }
    }

    const sair = acao && modo === 'sair'
    modo = 'acao'
    publicar(sair ? 'saindo' : 'processando')
    try {
      const resposta = await original(input, init)
      const redirecionamento = acao ? (resposta.headers.get('x-action-redirect') ?? '') : ''
      const recusa = RECUSA_DE_CONTA[mensagemDeErro(redirecionamento)]
      if (recusa) publicar(recusa)
      else if (!resposta.ok || mensagemDeErro(redirecionamento)) publicar('oculto')
      else publicar(sair ? 'encerrada' : 'concluida')
      return resposta
    } catch (erro) {
      publicar('oculto')
      throw erro
    }
  }
}

export function AvisoAcao() {
  const [fase, setFase] = useState<Fase>('oculto')

  useEffect(() => {
    ouvinte = setFase
    instalar()
    return () => {
      if (ouvinte === setFase) ouvinte = null
    }
  }, [])

  useEffect(() => {
    if (fase !== 'concluida' && fase !== 'encerrada' && fase !== 'bloqueada' && fase !== 'desativada') return
    const espera = fase === 'bloqueada' || fase === 'desativada' ? 2400 : 1600
    const timer = window.setTimeout(() => setFase('oculto'), espera)
    return () => window.clearTimeout(timer)
  }, [fase])

  if (fase === 'oculto') return null
  const girando = fase === 'processando' || fase === 'saindo'
  const recusa = fase === 'bloqueada' || fase === 'desativada'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={girando}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]"
    >
      <div className="aviso-painel flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl border bg-card px-10 py-10 text-center shadow-2xl">
        <span
          className={cn(
            'flex size-20 items-center justify-center rounded-full',
            girando && 'bg-primary/10 text-primary',
            recusa && 'bg-red-100 text-red-700',
            !girando && !recusa && 'bg-emerald-100 text-emerald-700',
          )}
        >
          {girando ? (
            <Clock className="size-10 animate-spin" aria-hidden />
          ) : recusa ? (
            <CircleX className="size-10" aria-hidden />
          ) : (
            <CircleCheck className="size-10" aria-hidden />
          )}
        </span>
        <p className={cn('text-xl font-semibold tracking-tight', recusa && 'text-red-700')}>{TEXTO[fase]}</p>
      </div>
    </div>
  )
}
