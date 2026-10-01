/** Versão estável visível na UI. Manter igual ao package.json. */
export const VERSAO_APP = '0.4'
export const VERSAO_SEMVER = '0.4.0'
/** Ainda não há publicação. Não usar a versão de DEV no lugar desta. */
export const VERSAO_PRODUCAO = 'não publicada'

export function shaDoBuild(): string {
  const bruto =
    process.env.NEXT_PUBLIC_GIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    ''
  return bruto.trim().slice(0, 7) || 'dev'
}

export function ambienteAtual() {
  const bruto = (process.env.APP_AMBIENTE || 'desenvolvimento').trim().toLowerCase()
  if (bruto === 'homologacao' || bruto === 'producao') return bruto
  return 'desenvolvimento'
}
