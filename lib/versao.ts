/** Versão estável visível na UI. Manter igual ao package.json. */
export const VERSAO_APP = '1.0'
export const VERSAO_SEMVER = '1.0.0'
/** Versão que a publicação na Vercel está servindo. */
export const VERSAO_PRODUCAO = '0.6.0'

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
