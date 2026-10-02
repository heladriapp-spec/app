import { AREAS_CRITICAS, CATALOGO_ENTREGAS } from '@/lib/entregas/catalogo'
import { parecerDaEntrega } from '@/lib/entregas/conflitos'
import { filaProximas, implantadas } from '@/lib/entregas/estado'
import type {
  ComplexidadeEntrega,
  EntregaEsteira,
  EntregaResolvida,
  EtapaTimeline,
  GateEsteira,
  GateEsteiraEstado,
  ItemFuturo,
  PainelEsteira,
  ParecerConflitos,
  RelatorioRelease,
  ResumoSaudeEsteira,
  RiscoEntrega,
  StatusGateEsteira,
} from '@/lib/entregas/tipos'
import { VERSAO_PRODUCAO, VERSAO_SEMVER } from '@/lib/versao'

export const GATES_ESTEIRA: { id: GateEsteira; label: string }[] = [
  { id: 'desenvolvimento', label: 'Desenvolvimento' },
  { id: 'validacao_dev', label: 'Validação DEV' },
  { id: 'homologacao', label: 'Homologação' },
  { id: 'aprovacao_producao', label: 'Aprovação Produção' },
  { id: 'deploy_producao', label: 'Deploy Produção' },
  { id: 'validacao_producao', label: 'Validação Produção' },
]

export const BACKLOG_FUTURO: ItemFuturo[] = [
  { nome: 'Leitura de PDF, planta e memorial', versao: 'depois do arquivo aceito' },
  { nome: 'Cliente, fornecedor, cronograma e dashboard da obra', versao: 'visão de produto' },
]

const GATE_LABEL: Record<GateEsteira, string> = Object.fromEntries(
  GATES_ESTEIRA.map((item) => [item.id, item.label]),
) as Record<GateEsteira, string>

export function rotuloGate(id: GateEsteira) {
  return GATE_LABEL[id]
}

export function complexidadeDaEntrega(item: EntregaResolvida): ComplexidadeEntrega {
  if (item.major) return 'alta'
  const criticas = item.areas.filter((area) => AREAS_CRITICAS.includes(area))
  if (criticas.length >= 2) return 'alta'
  if (criticas.length === 1) return 'media'
  return 'baixa'
}

export function riscoDaEntrega(item: EntregaResolvida): RiscoEntrega {
  if (item.major) return 'alto'
  if (item.areas.includes('auth') || item.areas.includes('banco')) return 'alto'
  if (item.areas.includes('planilha')) return 'medio'
  return 'baixo'
}

function primeiroPendente(gates: GateEsteiraEstado[]): GateEsteira | null {
  const aberto = gates.find(
    (gate) => gate.status === 'em_andamento' || gate.status === 'pendente',
  )
  return aberto?.id ?? null
}

function textoProximoPassoItem(
  item: EntregaResolvida,
  gate: GateEsteira | null,
  bloqueado: boolean,
  motivos: string[],
): string {
  if (item.statusBase === 'fora_de_escopo') {
    return 'Fora deste corte. A esteira não desenvolve esta entrega.'
  }
  if (item.statusDecisao === 'pedido_reversao') {
    return 'Pedido de reversão registrado. A esteira não desfaz o código sozinha.'
  }
  if (item.statusDecisao === 'rollback') {
    return 'Fora da fila. A próxima da ordem sobe no portal.'
  }
  if (bloqueado) return `Não avançar: ${motivos.join(' ')}`
  if (!gate) return 'Gates concluídos nesta esteira.'
  if (gate === 'desenvolvimento') {
    if (item.statusDecisao === 'aprovado') {
      return 'Aprovada para desenvolver. O próximo trabalho de código é esta entrega.'
    }
    return 'Aprovar em Implantações para desenvolver. Sugestão não vira aprovada sozinha.'
  }
  if (gate === 'validacao_dev') {
    return 'Validar em DEV (saúde do ambiente e logs) antes de pedir homologação.'
  }
  if (gate === 'homologacao') {
    return 'Aguardando homologação humana. Não promove Produção sozinha.'
  }
  if (gate === 'aprovacao_producao') {
    return 'Homologada. Falta aprovação explícita para Produção.'
  }
  if (gate === 'deploy_producao') {
    return 'Aprovada para Produção. A publicação ainda segue o passo do Git, não um botão desta tela.'
  }
  return 'Validar em Produção depois do deploy, no mesmo build homologado.'
}

function aprovacaoDoItem(item: EntregaResolvida, gate: GateEsteira | null): string {
  if (item.statusBase === 'fora_de_escopo') return 'Nenhuma. Saiu do escopo.'
  if (item.statusBase === 'validado_producao') return 'Nenhuma'
  if (item.statusDecisao === 'rollback' || item.statusDecisao === 'pedido_reversao') {
    return 'Tratar no portal'
  }
  if (gate === 'desenvolvimento' && item.statusDecisao !== 'aprovado') {
    return 'Aprovar para desenvolver'
  }
  if (gate === 'homologacao' || gate === 'aprovacao_producao') {
    return 'Homologação humana, depois aprovar Produção'
  }
  if (gate === 'deploy_producao' || gate === 'validacao_producao') {
    return 'Aprovação de Produção'
  }
  return 'Nenhuma para desenvolver; Produção depois da homologação'
}

export function gatesDaEntrega(item: EntregaResolvida): GateEsteiraEstado[] {
  const marcar = (status: StatusGateEsteira): GateEsteiraEstado[] =>
    GATES_ESTEIRA.map((gate) => ({ id: gate.id, status }))

  if (item.statusBase === 'fora_de_escopo') {
    return GATES_ESTEIRA.map((gate) => ({
      id: gate.id,
      status: gate.id === 'desenvolvimento' ? 'bloqueado' : 'pendente',
    }))
  }
  if (item.statusDecisao === 'pedido_reversao') {
    return GATES_ESTEIRA.map((gate) => ({
      id: gate.id,
      status: gate.id === 'validacao_producao' ? 'bloqueado' : 'concluido',
    }))
  }
  if (item.statusDecisao === 'rollback') {
    return GATES_ESTEIRA.map((gate) => ({
      id: gate.id,
      status: gate.id === 'desenvolvimento' ? 'bloqueado' : 'pendente',
    }))
  }
  if (item.statusBase === 'validado_producao') return marcar('concluido')
  if (item.implantadoVisual) {
    return GATES_ESTEIRA.map((gate) => {
      if (gate.id === 'desenvolvimento' || gate.id === 'validacao_dev') {
        return { id: gate.id, status: 'concluido' }
      }
      if (gate.id === 'homologacao') return { id: gate.id, status: 'em_andamento' }
      return { id: gate.id, status: 'pendente' }
    })
  }
  if (item.statusDecisao === 'aprovado') {
    return GATES_ESTEIRA.map((gate) => ({
      id: gate.id,
      status: gate.id === 'desenvolvimento' ? 'em_andamento' : 'pendente',
    }))
  }
  return marcar('pendente')
}

function ambienteDaEntrega(item: EntregaResolvida): EntregaEsteira['ambiente'] {
  if (item.statusBase === 'validado_producao') return 'producao'
  if (item.implantadoVisual) return 'dev'
  return 'fila'
}

export function enriquecerEntrega(
  item: EntregaResolvida,
  parecer?: ParecerConflitos,
): EntregaEsteira {
  const gates = gatesDaEntrega(item)
  const itemParecer = parecer ? parecerDaEntrega(parecer, item.id) : null
  const bloqueado = itemParecer?.nivel === 'bloqueado'
  const gate = bloqueado ? 'desenvolvimento' : primeiroPendente(gates)
  return {
    ...item,
    complexidade: complexidadeDaEntrega(item),
    risco: riscoDaEntrega(item),
    gates,
    ambiente: ambienteDaEntrega(item),
    proximoPasso: textoProximoPassoItem(item, gate, Boolean(bloqueado), itemParecer?.motivos ?? []),
    aprovacaoNecessaria: aprovacaoDoItem(item, gate),
  }
}

function relatorioDaRelease(
  item: EntregaEsteira,
  proximaSugerida: EntregaEsteira | null,
  buildAtual: string,
  saude: ResumoSaudeEsteira | null,
): RelatorioRelease {
  const destaVersao = item.versaoEfetiva === VERSAO_SEMVER
  return {
    item,
    versao: item.versaoEfetiva ?? item.versaoPrevista,
    build: destaVersao ? buildAtual : null,
    commit: destaVersao ? buildAtual : null,
    testes: destaVersao
      ? saude
        ? `${saude.erros} erro(s), ${saude.alertas} alerta(s) na saúde deste processo`
        : 'Saúde indisponível nesta leitura'
      : 'Build histórico não está nesta tela',
    health: destaVersao
      ? saude
        ? `${saude.status} · capacidade ${saude.capacity.status}`
        : 'Indisponível'
      : 'Resumo só da versão em execução',
    docs: 'PRD na mesma entrega. A esteira aponta o passo; não substitui o documento.',
    pendencias:
      item.statusDecisao === 'pedido_reversao'
        ? 'Pedido de reversão em aberto'
        : item.statusBase === 'nesta_versao'
          ? 'Aguardando homologação humana e Produção'
          : 'Nenhuma registrada',
    proximaSugerida: proximaSugerida
      ? `${proximaSugerida.nome} (${proximaSugerida.versaoPrevista})`
      : null,
  }
}

function motivoOrdem(atual: EntregaResolvida[], catalogoIds: string[]) {
  const adiadas = atual.filter((item) => item.statusDecisao === 'adiado').map((item) => item.nome)
  const fora = CATALOGO_ENTREGAS.filter(
    (item) =>
      !item.implantado &&
      item.statusBase !== 'fora_de_escopo' &&
      atual.every((row) => row.id !== item.id),
  )
  const partes: string[] = []
  if (adiadas.length > 0) partes.push(`Passou à frente: ${adiadas.join('; ')}.`)
  if (fora.length > 0) partes.push(`Fora da fila: ${fora.map((item) => item.nome).join('; ')}.`)
  const iguais =
    atual.length === catalogoIds.length && atual.every((item, i) => item.id === catalogoIds[i])
  if (iguais) return 'A ordem vigente coincide com a proposta do catálogo.'
  if (partes.length === 0) {
    return 'A ordem vigente diverge do catálogo por decisão em Implantações.'
  }
  return `${partes.join(' ')} Mudar a ordem continua sendo decisão em Implantações.`
}

export function montarPainelEsteira(input: {
  resolvidas: EntregaResolvida[]
  fila: EntregaResolvida[]
  parecer: ParecerConflitos
  build: string
  ambiente: string
  saude: ResumoSaudeEsteira | null
}): PainelEsteira {
  const enriquecidas = input.resolvidas.map((item) => enriquecerEntrega(item, input.parecer))
  const porId = new Map(enriquecidas.map((item) => [item.id, item]))
  const fila = input.fila
    .map((item) => porId.get(item.id))
    .filter((item): item is EntregaEsteira => Boolean(item))

  const aprovada = fila.find((item) => item.statusDecisao === 'aprovado') ?? null
  const destaVersao =
    enriquecidas.find((item) => item.implantadoVisual && item.versaoEfetiva === VERSAO_SEMVER) ??
    null
  const entregaAtual = aprovada ?? destaVersao
  const origemAtual = aprovada ? 'aprovada' : destaVersao ? 'nesta_versao' : null
  const proximaSugerida = fila.find((item) => item.id !== entregaAtual?.id) ?? fila[0] ?? null

  const itemParecerAtual = entregaAtual
    ? parecerDaEntrega(input.parecer, entregaAtual.id)
    : proximaSugerida
      ? parecerDaEntrega(input.parecer, proximaSugerida.id)
      : null

  let proximoPasso: PainelEsteira['proximoPasso']
  if (itemParecerAtual?.nivel === 'bloqueado') {
    proximoPasso = {
      texto: `Não avançar: ${itemParecerAtual.motivos.join(' ')}`,
      gate: null,
      entregaId: entregaAtual?.id ?? proximaSugerida?.id ?? null,
    }
  } else if (entregaAtual) {
    proximoPasso = {
      texto: entregaAtual.proximoPasso,
      gate: primeiroPendente(entregaAtual.gates),
      entregaId: entregaAtual.id,
    }
  } else if (proximaSugerida) {
    proximoPasso = {
      texto: proximaSugerida.proximoPasso,
      gate: primeiroPendente(proximaSugerida.gates),
      entregaId: proximaSugerida.id,
    }
  } else {
    proximoPasso = { texto: 'Fila vazia.', gate: null, entregaId: null }
  }

  const jaSaiu = implantadas(input.resolvidas)
    .map((item) => porId.get(item.id))
    .filter((item): item is EntregaEsteira => Boolean(item))
  const emDesenvolvimento = fila.filter((item) => item.statusDecisao === 'aprovado')
  const cabeca = fila.filter(
    (item) => item.id !== entregaAtual?.id && item.statusDecisao !== 'aprovado',
  )

  const ordemCatalogo = filaProximas(
    input.resolvidas.map((item) => ({
      ...item,
      statusDecisao:
        item.statusDecisao === 'adiado' || item.statusDecisao === 'rollback'
          ? null
          : item.statusDecisao,
      posicao: item.ordemPrioridade,
    })),
  ).map((item) => item.id)

  return {
    versaoProducao: VERSAO_PRODUCAO,
    versaoDev: VERSAO_SEMVER,
    build: input.build,
    ambiente: input.ambiente,
    entregaAtual,
    origemAtual,
    proximaSugerida: proximaSugerida?.statusDecisao === 'aprovado' ? null : proximaSugerida,
    proximoPasso,
    proximoGate: proximoPasso.gate,
    timeline: {
      implantado: jaSaiu,
      em_desenvolvimento: emDesenvolvimento,
      proxima: cabeca.slice(0, 1),
      planejado: cabeca.slice(1),
      futuro: [],
    } satisfies Record<EtapaTimeline, EntregaEsteira[]>,
    roadmap: {
      agora: entregaAtual ? [entregaAtual] : [],
      proximo: cabeca.slice(0, 1),
      depois: cabeca.slice(1),
      futuro: BACKLOG_FUTURO,
    },
    ordemAtual: fila.map((item) => item.id),
    ordemCatalogo,
    ordemAtualNomes: fila.map((item) => item.nome),
    ordemCatalogoNomes: ordemCatalogo.map(
      (id) => porId.get(id)?.nome ?? CATALOGO_ENTREGAS.find((item) => item.id === id)?.nome ?? id,
    ),
    ordemDiferente:
      fila.length !== ordemCatalogo.length || fila.some((item, i) => item.id !== ordemCatalogo[i]),
    motivoOrdem: motivoOrdem(input.fila, ordemCatalogo),
    parecer: input.parecer,
    historico: jaSaiu.map((item) =>
      relatorioDaRelease(item, proximaSugerida, input.build, input.saude),
    ),
    saude: input.saude,
  }
}

export function resumirSaudeEsteira(relatorio: {
  status: ResumoSaudeEsteira['status']
  versao: string
  build: string
  ambiente: string
  prerequisites: { status: string; mensagem: string }
  capacity: { status: string; mensagem: string }
  contagem: { alerta: number; erro: number }
  checks: Array<{ id: string; status: string; mensagem: string }>
}): ResumoSaudeEsteira {
  const performance = relatorio.checks.find((check) => check.id === 'performance')
  return {
    status: relatorio.status,
    versao: relatorio.versao,
    build: relatorio.build,
    ambiente: relatorio.ambiente,
    prerequisites: relatorio.prerequisites,
    capacity: relatorio.capacity,
    performance: {
      status: performance?.status ?? 'nao_aplicavel',
      mensagem: performance?.mensagem ?? 'Sem medição de latência neste corte.',
    },
    parecerPerformance: performance?.mensagem ?? 'Sem medição de latência neste corte.',
    alertas: relatorio.contagem.alerta,
    erros: relatorio.contagem.erro,
  }
}
