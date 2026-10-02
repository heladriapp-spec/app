export function validarLogin(bruto: string): { ok: true; login: string } | { ok: false; erro: string } {
  const login = bruto.trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,32}$/.test(login)) {
    return {
      ok: false,
      erro: 'O usuário usa 3 a 32 caracteres: letras, números, ponto, _ ou -.',
    }
  }
  return { ok: true, login }
}

export function validarSenha(senha: string, senha2: string) {
  if (senha.length < 8) return 'A senha precisa de ao menos 8 caracteres.'
  if (senha !== senha2) return 'A senha nova e a repetição não são iguais.'
  return null
}
