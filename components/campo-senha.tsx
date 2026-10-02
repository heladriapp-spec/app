'use client'

import { avisosSenha, type PessoaSenha } from '@/lib/auth/politica-senha'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'

export function CampoSenha({ pessoa }: { pessoa: PessoaSenha }) {
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const avisos = avisosSenha(senha, senha2, pessoa)

  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          autoComplete="new-password"
          required
          value={senha}
          onChange={(evento) => setSenha(evento.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="senha2">Repetir senha</Label>
        <Input
          id="senha2"
          name="senha2"
          type="password"
          autoComplete="new-password"
          required
          value={senha2}
          onChange={(evento) => setSenha2(evento.target.value)}
        />
      </div>
      {avisos.length > 0 ? (
        <ul className="grid gap-1 text-sm text-destructive">
          {avisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
      ) : null}
    </>
  )
}
