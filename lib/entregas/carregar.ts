import { parecerDaFila, resolverEntregas } from '@/lib/entregas/estado'
import { montarPainelEsteira, resumirSaudeEsteira } from '@/lib/entregas/esteira'
import { listarEstadosEntrega } from '@/lib/operacao/store'
import { montarRelatorioSaude } from '@/lib/saude/executar'
import { ambienteAtual, shaDoBuild } from '@/lib/versao'

export async function carregarResolvidas() {
  const estados = await listarEstadosEntrega()
  const resolvidas = resolverEntregas(estados)
  const { fila, parecer } = parecerDaFila(resolvidas)
  return { resolvidas, fila, parecer }
}

export async function carregarPainelEsteira() {
  const [{ resolvidas, fila, parecer }, saude] = await Promise.all([
    carregarResolvidas(),
    montarRelatorioSaude(),
  ])
  return montarPainelEsteira({
    resolvidas,
    fila,
    parecer,
    build: shaDoBuild(),
    ambiente: ambienteAtual(),
    saude: resumirSaudeEsteira(saude),
  })
}
