import { CATALOGO_ENTREGAS } from '@/lib/entregas/catalogo'
import type { CheckResultado, RelatorioSaude, ResumoEixo, StatusSaude } from '@/lib/saude/tipos'
import { pingUsuarios, supabaseConfigurado } from '@/lib/supabase/nuvem'
import { VERSAO_APP, VERSAO_SEMVER, ambienteAtual, shaDoBuild } from '@/lib/versao'
import { access, readFile, readdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const VARIAVEIS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const

async function medir(
  parcial: Omit<CheckResultado, 'duracaoMs'>,
  inicio: number,
): Promise<CheckResultado> {
  return { ...parcial, duracaoMs: Date.now() - inicio }
}

function eixo(checks: CheckResultado[], ids: string[]): ResumoEixo {
  const relevantes = checks.filter(
    (check) => ids.includes(check.id) && check.status !== 'nao_aplicavel',
  )
  if (relevantes.length === 0) {
    return { status: 'nao_aplicavel', mensagem: 'Nada a medir neste corte.' }
  }
  if (relevantes.some((check) => check.status === 'erro')) {
    return {
      status: 'erro',
      mensagem: relevantes
        .filter((check) => check.status === 'erro')
        .map((check) => check.mensagem)
        .join(' '),
    }
  }
  if (relevantes.some((check) => check.status === 'alerta')) {
    return {
      status: 'alerta',
      mensagem: relevantes
        .filter((check) => check.status === 'alerta')
        .map((check) => check.mensagem)
        .join(' '),
    }
  }
  return { status: 'ok', mensagem: relevantes.map((check) => check.nome).join(', ') + '.' }
}

function statusGeral(checks: CheckResultado[]): StatusSaude {
  const visiveis = checks.filter((check) => check.status !== 'nao_aplicavel')
  if (visiveis.some((check) => check.status === 'erro' && check.criticidade === 'critico')) {
    return 'UNHEALTHY'
  }
  if (visiveis.some((check) => check.status === 'erro' || check.status === 'alerta')) {
    return 'DEGRADED'
  }
  return 'HEALTHY'
}

function contagem(checks: CheckResultado[]) {
  return {
    ok: checks.filter((check) => check.status === 'ok').length,
    alerta: checks.filter((check) => check.status === 'alerta').length,
    erro: checks.filter((check) => check.status === 'erro').length,
    naoAplicavel: checks.filter((check) => check.status === 'nao_aplicavel').length,
  }
}

async function checkVersao(): Promise<CheckResultado> {
  const inicio = Date.now()
  const bruto = await readFile(path.join(process.cwd(), 'package.json'), 'utf8')
  const pkg = JSON.parse(bruto) as { version?: string }
  const confere = pkg.version === VERSAO_SEMVER
  return medir(
    {
      id: 'versao',
      nome: 'Versão declarada',
      grupo: 'ambiente',
      status: confere ? 'ok' : 'erro',
      criticidade: 'critico',
      mensagem: confere
        ? `package.json e a aplicação estão em ${VERSAO_SEMVER}.`
        : `package.json diz ${pkg.version ?? 'sem versão'} e a aplicação diz ${VERSAO_SEMVER}.`,
      detalhe: null,
    },
    inicio,
  )
}

async function checkCatalogo(): Promise<CheckResultado> {
  const inicio = Date.now()
  const atual = CATALOGO_ENTREGAS.find(
    (item) => item.versaoEfetiva === VERSAO_SEMVER && item.implantado,
  )
  return medir(
    {
      id: 'catalogo',
      nome: 'Catálogo da versão em execução',
      grupo: 'ambiente',
      status: atual ? 'ok' : 'erro',
      criticidade: 'critico',
      mensagem: atual
        ? `A ${VERSAO_SEMVER} está no catálogo como “${atual.nome}”.`
        : `Nenhuma entrega implantada aponta para ${VERSAO_SEMVER}.`,
      detalhe: atual?.id ?? null,
    },
    inicio,
  )
}

async function checkProcesso(): Promise<CheckResultado> {
  const inicio = Date.now()
  return medir(
    {
      id: 'processo',
      nome: 'Processo Node',
      grupo: 'ambiente',
      status: 'ok',
      criticidade: 'critico',
      mensagem: `Node ${process.version} respondeu.`,
      detalhe: `pid ${process.pid}`,
    },
    inicio,
  )
}

async function checkArquivoLocal(): Promise<CheckResultado> {
  const inicio = Date.now()
  if (supabaseConfigurado()) {
    return medir(
      {
        id: 'arquivo-local',
        nome: 'Arquivo local de operação',
        grupo: 'ambiente',
        status: 'ok',
        criticidade: 'nao_critico',
        mensagem: 'Usuários, pedidos e projetos deste ambiente ficam no Supabase. A pasta data não é a fonte.',
        detalhe: null,
      },
      inicio,
    )
  }
  const pasta = path.join(process.cwd(), 'data')
  try {
    await access(pasta)
    return medir(
      {
        id: 'arquivo-local',
        nome: 'Arquivo local de operação',
        grupo: 'ambiente',
        status: 'ok',
        criticidade: 'critico',
        mensagem: 'A pasta data existe. Usuários, fila e logs deste corte ficam aí até o Supabase.',
        detalhe: null,
      },
      inicio,
    )
  } catch {
    return medir(
      {
        id: 'arquivo-local',
        nome: 'Arquivo local de operação',
        grupo: 'ambiente',
        status: 'alerta',
        criticidade: 'nao_critico',
        mensagem: 'A pasta data ainda não existe. O primeiro login cria o arquivo.',
        detalhe: null,
      },
      inicio,
    )
  }
}

async function checkGit(): Promise<CheckResultado> {
  const inicio = Date.now()
  try {
    await access(path.join(process.cwd(), '.git'))
    return medir(
      {
        id: 'git-proprio',
        nome: 'Repositório próprio',
        grupo: 'ambiente',
        status: 'ok',
        criticidade: 'nao_critico',
        mensagem: 'Este diretório tem .git próprio.',
        detalhe: null,
      },
      inicio,
    )
  } catch {
    return medir(
      {
        id: 'git-proprio',
        nome: 'Repositório próprio',
        grupo: 'ambiente',
        status: 'alerta',
        criticidade: 'nao_critico',
        mensagem: 'Este diretório ainda não tem .git próprio. Esse passo fica depois do corte da planilha.',
        detalhe: null,
      },
      inicio,
    )
  }
}

async function checkSupabase(): Promise<CheckResultado> {
  const inicio = Date.now()
  const ausentes = VARIAVEIS.filter((nome) => !process.env[nome]?.trim())
  if (ausentes.length > 0) {
    return medir(
      {
        id: 'supabase-contrato',
        nome: 'Contrato do Supabase',
        grupo: 'ambiente',
        status: 'alerta',
        criticidade: 'nao_critico',
        mensagem: `Ainda sem ${ausentes.join(' e ')}. Sem elas a operação continua no arquivo local.`,
        detalhe: null,
      },
      inicio,
    )
  }
  try {
    await pingUsuarios()
    return medir(
      {
        id: 'supabase-contrato',
        nome: 'Contrato do Supabase',
        grupo: 'ambiente',
        status: 'ok',
        criticidade: 'nao_critico',
        mensagem: 'O servidor leu a tabela de usuários no Supabase. A chave não aparece aqui.',
        detalhe: null,
      },
      inicio,
    )
  } catch {
    return medir(
      {
        id: 'supabase-contrato',
        nome: 'Contrato do Supabase',
        grupo: 'ambiente',
        status: 'erro',
        criticidade: 'critico',
        mensagem: 'O servidor não conseguiu ler o Supabase. A chave não aparece aqui.',
        detalhe: null,
      },
      inicio,
    )
  }
}

async function checkMemoria(): Promise<CheckResultado> {
  const inicio = Date.now()
  const livre = os.freemem()
  const total = os.totalmem()
  const rss = process.memoryUsage().rss
  const livreMb = Math.round(livre / 1024 / 1024)
  const rssMb = Math.round(rss / 1024 / 1024)
  const apertado = livre < 256 * 1024 * 1024 || rss / total >= 0.45
  return medir(
    {
      id: 'memoria',
      nome: 'Memória',
      grupo: 'ambiente',
      status: apertado ? 'alerta' : 'ok',
      criticidade: 'nao_critico',
      mensagem: apertado
        ? `Margem curta: ${livreMb} MB livres, processo em ${rssMb} MB.`
        : `${livreMb} MB livres, processo em ${rssMb} MB.`,
      detalhe: null,
    },
    inicio,
  )
}

async function checkPerformance(): Promise<CheckResultado> {
  const inicio = Date.now()
  return medir(
    {
      id: 'performance',
      nome: 'Latência',
      grupo: 'ambiente',
      status: 'nao_aplicavel',
      criticidade: 'nao_critico',
      mensagem: 'Este corte ainda não mede latência de planilha.',
      detalhe: null,
    },
    inicio,
  )
}

async function checkPlanilha(): Promise<CheckResultado> {
  const inicio = Date.now()
  const nomes = await readdir(process.cwd())
  const arquivos = nomes.filter((nome) => nome.toLowerCase().endsWith('.xlsx'))
  return medir(
    {
      id: 'planilha-amostra',
      nome: 'Planilha de amostra',
      grupo: 'produto',
      status: arquivos.length > 0 ? 'ok' : 'alerta',
      criticidade: 'nao_critico',
      mensagem:
        arquivos.length > 0
          ? `${arquivos.length} arquivo(s) .xlsx na pasta do portal. A leitura entra na entrega do projeto.`
          : 'Nenhum .xlsx na pasta do portal. O leitor precisa do arquivo do trabalho.',
      detalhe: arquivos.length > 0 ? arquivos.join(', ') : null,
    },
    inicio,
  )
}

export async function montarRelatorioSaude(): Promise<RelatorioSaude> {
  const inicio = Date.now()
  const checks = await Promise.all([
    checkProcesso(),
    checkVersao(),
    checkCatalogo(),
    checkArquivoLocal(),
    checkGit(),
    checkSupabase(),
    checkMemoria(),
    checkPerformance(),
    checkPlanilha(),
  ])
  return {
    status: statusGeral(checks),
    versao: VERSAO_SEMVER,
    versaoPublica: VERSAO_APP,
    build: shaDoBuild(),
    ambiente: ambienteAtual(),
    runtime: process.version,
    momento: new Date().toISOString(),
    duracaoMs: Date.now() - inicio,
    contagem: contagem(checks),
    checks,
    prerequisites: eixo(checks, ['git-proprio', 'supabase-contrato', 'arquivo-local']),
    capacity: eixo(checks, ['memoria']),
  }
}

export function serializarPublico(relatorio: RelatorioSaude) {
  return {
    status: relatorio.status,
    versao: relatorio.versao,
    build: relatorio.build,
    ambiente: relatorio.ambiente,
    runtime: relatorio.runtime,
    momento: relatorio.momento,
    duracaoMs: relatorio.duracaoMs,
    contagem: relatorio.contagem,
    prerequisites: relatorio.prerequisites,
    capacity: relatorio.capacity,
    checks: relatorio.checks
      .filter((check) => check.status !== 'nao_aplicavel')
      .map((check) => ({
        id: check.id,
        nome: check.nome,
        grupo: check.grupo,
        status: check.status,
        mensagem: check.mensagem,
      })),
  }
}
