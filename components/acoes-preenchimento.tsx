'use client'

import { BotaoSalvar, BotaoSubmeter } from '@/components/botao-rascunho'

export function AcoesPreenchimento({ salvo = false }: { salvo?: boolean }) {
  return (
    <>
      <BotaoSalvar salvo={salvo} />
      <BotaoSubmeter />
    </>
  )
}
