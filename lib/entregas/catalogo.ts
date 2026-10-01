import type { EntregaCatalogo } from '@/lib/entregas/tipos'

/**
 * Fila deste portal. Cada item é um passo do Heladri (planilha do SESC).
 * A camada de operação é genérica; o catálogo abaixo é só deste produto.
 */
export const CATALOGO_ENTREGAS: EntregaCatalogo[] = [
  {
    id: 'av1-operacao',
    nome: 'Operação da aplicação',
    resumo:
      'Usuários, versão, implantações, esteira, logs e saúde do ambiente. Vale para operar o portal; o trabalho continua sendo a planilha do SESC.',
    tipo: 'nova_funcionalidade',
    versaoPrevista: '0.1.0',
    versaoEfetiva: '0.1.0',
    statusBase: 'nesta_versao',
    implantado: true,
    ordemPrioridade: 0,
    dependsOn: [],
    areas: ['ui', 'auth', 'saude', 'docs'],
  },
  {
    id: 'projeto-planilha',
    nome: 'Projeto a partir da planilha do SESC',
    resumo:
      'Depois do login, a lista de projetos. Criar novo projeto pede nome, data e o upload da planilha. A tela de preenchimento nasce desse arquivo, na máquina.',
    tipo: 'nova_funcionalidade',
    versaoPrevista: '0.2.0',
    versaoEfetiva: '0.2.0',
    statusBase: 'nesta_versao',
    implantado: true,
    ordemPrioridade: 10,
    dependsOn: ['av1-operacao'],
    areas: ['planilha', 'ui'],
    major: true,
  },
  {
    id: 'contas-manuais',
    nome: 'Contas criadas pelo administrador',
    resumo:
      'O administrador cria a conta com usuário e senha, troca a senha e exclui o usuário. O pedido de acesso continua na fila; o e-mail de confirmação fica na entrega do remetente.',
    tipo: 'nova_funcionalidade',
    versaoPrevista: '0.3.0',
    versaoEfetiva: '0.3.0',
    statusBase: 'nesta_versao',
    implantado: true,
    ordemPrioridade: 15,
    dependsOn: ['av1-operacao'],
    areas: ['auth', 'ui'],
  },
  {
    id: 'capitulos-planilha',
    nome: 'Preenchimento por capítulos',
    resumo:
      'O índice à esquerda lista as seções da planilha. Capítulo preenchido fica verde; o que falta valor fica laranja. Baixar devolve o mesmo arquivo, com os valores gravados nas células de entrada.',
    tipo: 'nova_funcionalidade',
    versaoPrevista: '0.4.0',
    versaoEfetiva: '0.4.0',
    statusBase: 'nesta_versao',
    implantado: true,
    ordemPrioridade: 18,
    dependsOn: ['projeto-planilha'],
    areas: ['planilha', 'ui'],
  },
  {
    id: 'preenchimento',
    nome: 'Rascunho, arquivo referencial e conclusão',
    resumo:
      'A planilha enviada fica amarrada ao projeto e guardada com os dados. Dá para salvar em rascunho. Concluir grava os valores do banco numa cópia fiel dessa planilha e guarda o arquivo gerado.',
    tipo: 'nova_funcionalidade',
    versaoPrevista: '0.5.0',
    versaoEfetiva: '0.5.0',
    statusBase: 'nesta_versao',
    implantado: true,
    ordemPrioridade: 20,
    dependsOn: ['projeto-planilha'],
    areas: ['planilha', 'ui'],
  },
  {
    id: 'git-proprio',
    nome: 'Repositório Git só do Heladri',
    resumo:
      'Versionar este portal num remoto que a publicação consiga ligar. Não trava o corte da planilha na máquina.',
    tipo: 'melhoria',
    versaoPrevista: '0.6.0',
    versaoEfetiva: null,
    statusBase: 'planejado',
    implantado: false,
    ordemPrioridade: 30,
    dependsOn: ['av1-operacao'],
    areas: ['docs'],
  },
  {
    id: 'supabase',
    nome: 'Supabase: banco, arquivos e sessão na nuvem',
    resumo:
      'Usuários, pedidos, projetos e a planilha de origem passam do arquivo local para o Postgres e o Storage. A chave fica fora do Git.',
    tipo: 'nova_funcionalidade',
    versaoPrevista: '0.7.0',
    versaoEfetiva: null,
    statusBase: 'planejado',
    implantado: false,
    ordemPrioridade: 40,
    dependsOn: ['git-proprio'],
    areas: ['banco', 'auth'],
  },
  {
    id: 'email',
    nome: 'Remetente de confirmação e de senha',
    resumo:
      'Aprovar um pedido passa a enviar o link de uso único. Esqueci a senha usa o mesmo remetente. Até lá o administrador cria a conta na mão. Contas da instalação continuam sem e-mail.',
    tipo: 'melhoria',
    versaoPrevista: '0.8.0',
    versaoEfetiva: null,
    statusBase: 'planejado',
    implantado: false,
    ordemPrioridade: 50,
    dependsOn: ['supabase'],
    areas: ['auth'],
  },
  {
    id: 'vercel',
    nome: 'Publicação na Vercel a partir do Git',
    resumo:
      'O primeiro deploy espera o fluxo local de pé. O seguinte sai do Git, no plano gratuito, sem banco da Vercel.',
    tipo: 'melhoria',
    versaoPrevista: '0.9.0',
    versaoEfetiva: null,
    statusBase: 'planejado',
    implantado: false,
    ordemPrioridade: 60,
    dependsOn: ['git-proprio', 'supabase'],
    areas: ['docs'],
  },
  {
    id: 'versoes-planilha',
    nome: 'Histórico e versões do preenchimento',
    resumo:
      'Quem alterou cada campo, exclusão e reinclusão, e a lista de versões do estado da planilha.',
    tipo: 'nova_funcionalidade',
    versaoPrevista: '1.0.0',
    versaoEfetiva: null,
    statusBase: 'planejado',
    implantado: false,
    ordemPrioridade: 70,
    dependsOn: ['preenchimento'],
    areas: ['planilha', 'banco'],
  },
  {
    id: 'segundo-arquivo',
    nome: 'Segundo trabalho antes de generalizar o leitor',
    resumo:
      'Outra planilha do SESC, para ver se aba, colunas e fórmulas se repetem. Até lá o Anexo III do Cosmo/Chão não vira modelo universal.',
    tipo: 'melhoria',
    versaoPrevista: '1.1.0',
    versaoEfetiva: null,
    statusBase: 'planejado',
    implantado: false,
    ordemPrioridade: 80,
    dependsOn: ['projeto-planilha'],
    areas: ['planilha', 'docs'],
  },
  {
    id: 'motor-cotacao',
    nome: 'Motor de cotação deste trabalho',
    resumo:
      'Rateio de material e mão de obra para as colunas F e G. Não entra no primeiro deploy e não substitui o arquivo do SESC.',
    tipo: 'nova_funcionalidade',
    versaoPrevista: '1.2.0',
    versaoEfetiva: null,
    statusBase: 'proposto',
    implantado: false,
    ordemPrioridade: 90,
    dependsOn: ['preenchimento'],
    areas: ['planilha'],
    major: true,
  },
]

export function entregaPorId(id: string) {
  return CATALOGO_ENTREGAS.find((item) => item.id === id) ?? null
}

export const AREAS_CRITICAS: Array<EntregaCatalogo['areas'][number]> = [
  'banco',
  'auth',
  'planilha',
]
