'use client'

import { BotaoConcluir, BotaoSalvar, BotaoSubmeter } from '@/components/botao-rascunho'

export function AcoesPreenchimento({
  salvo = false,
  etapa = 'preparacao',
}: {
  salvo?: boolean
  etapa?: 'preparacao' | 'execucao'
}) {
  return (
    <>
      <BotaoSalvar salvo={salvo} />
      {etapa === 'execucao' ? <BotaoConcluir /> : <BotaoSubmeter />}
    </>
  )
}
