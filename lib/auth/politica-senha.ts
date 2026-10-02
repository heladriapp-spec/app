/** Regras de senha usadas na tela e no servidor. Sem rede e sem lista paga. */

const COMUNS = new Set([
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'qwerty',
  'qwerty123',
  'abcdef',
  'abc123',
  '111111',
  '000000',
  'senha',
  'senha123',
  'admin',
  'administrador',
  'letmein',
  'welcome',
  'iloveyou',
  'monkey',
  'dragon',
  'master',
  'login',
  'passw0rd',
  'changeme',
])

const SEQUENCIAS = ['0123456789', '9876543210', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm']

export type PessoaSenha = {
  primeiroNome: string
  sobrenome: string
  email: string
}

export function partirNome(nome: string) {
  const limpo = nome.trim().replace(/\s+/g, ' ')
  const espaco = limpo.indexOf(' ')
  if (espaco < 0) return { primeiroNome: limpo, sobrenome: '' }
  return { primeiroNome: limpo.slice(0, espaco), sobrenome: limpo.slice(espaco + 1).trim() }
}

export function nomeCompleto(primeiroNome: string, sobrenome: string) {
  return [primeiroNome.trim(), sobrenome.trim()].filter(Boolean).join(' ')
}

export function avisosSenha(senha: string, senha2: string, pessoa: PessoaSenha) {
  if (!senha && !senha2) return []
  const avisos: string[] = []
  if (senha.length < 12) avisos.push('A senha deve ter pelo menos 12 caracteres.')
  if (senha2 && senha !== senha2) avisos.push('As senhas informadas não coincidem.')
  const normal = normalizar(senha)
  if (contem(normal, pessoa.primeiroNome)) avisos.push('A senha não pode conter seu primeiro nome.')
  if (contem(normal, pessoa.sobrenome)) avisos.push('A senha não pode conter seu sobrenome.')
  if (contemEmail(normal, pessoa.email)) avisos.push('A senha não pode conter partes do seu e-mail.')
  if (sequenciaFacil(normal)) avisos.push('Essa sequência é muito fácil de adivinhar.')
  if (COMUNS.has(normal) || COMUNS.has(senha.toLowerCase())) {
    avisos.push('Essa senha é muito comum ou previsível.')
  }
  return avisos
}

function normalizar(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function contem(senha: string, parte: string) {
  const trecho = normalizar(parte).replace(/\s+/g, '')
  return trecho.length >= 3 && senha.includes(trecho)
}

function contemEmail(senha: string, email: string) {
  const [local = '', dominio = ''] = normalizar(email).split('@')
  const partes = [...local.split(/[._+-]+/), dominio.split('.')[0] ?? '']
  return partes.some((parte) => parte.length >= 3 && senha.includes(parte))
}

function sequenciaFacil(senha: string) {
  if (/(.)\1{3,}/.test(senha)) return true
  return SEQUENCIAS.some((serie) => {
    for (let i = 0; i <= serie.length - 4; i++) {
      const trecho = serie.slice(i, i + 4)
      if (senha.includes(trecho)) return true
    }
    return false
  })
}
