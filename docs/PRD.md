# PRD — Heladri MVP

Portal web para preencher planilhas de licitação do SESC e devolvê-las no mesmo arquivo.

**Status:** 0.6.0 — o preenchimento abre por capítulos, no índice à esquerda. Capítulo com todos os valores fica verde; o que ainda falta fica laranja. Baixar devolve o mesmo arquivo, com os valores gravados nas células de entrada. No item de serviço, um extra interno compõe o preço na tela; a planilha exportada recebe só o valor final, sem percentual, margem ou menção ao extra. Concluir, excluir linha e o histórico de versões continuam na fila.  
**Escopo:** primeiro momento — só a dor da planilha  
**Nome de trabalho:** Heladri (nome da pasta do projeto)

## 1. Problema

O trabalho de cenografia concentra orçamento, cliente, parceiros e fornecedores em uma pessoa. Neste primeiro momento, a dor que mais desgasta é outra, mais estreita.

Cada trabalho do SESC chega por licitação e traz a própria planilha. Essa planilha precisa ser preenchida com quantidades e valores e devolvida para o sócio subir no sistema do SESC. Hoje isso acontece assim:

1. A planilha chega, diferente a cada trabalho.
2. Alguém lê manual técnico e normativa para destrinchar custo — em vários serviços o SESC pede o valor por metro quadrado.
3. Os números são digitados na planilha.
4. A planilha é atualizada de novo cada vez que um valor muda, às vezes por mais de uma pessoa, sem ficar claro quem mexeu no quê.
5. O arquivo é enviado ao sócio (mensagem, e-mail, pasta compartilhada).
6. O sócio sobe o arquivo no sistema do SESC.

O desgaste não é “fazer orçamento”. É manter a planilha viva, no formato que o SESC aceita, com várias pessoas no mesmo trabalho, e repassar esse arquivo toda hora.

No relato, o órgão aparece como “Sasc” e “Sesque”. Este PRD trata como **SESC** (Serviço Social do Comércio). Se for outra instituição, o fluxo não muda: muda o nome e o modelo do arquivo.

## 2. Objetivo do MVP

Um portal web, com login, em que cada trabalho do SESC é um projeto.

Quem pode criar projeto sobe a planilha daquele trabalho. O sistema lê o arquivo e monta a estrutura na web, para preencher quantidade e valor item a item, sem digitar a grade à mão. Mais de uma pessoa atua no mesmo projeto. Ao concluir, um botão gera e baixa o arquivo final: mesmos tipo, extensão e estrutura do original, com os valores preenchidos e com as linhas que foram excluídas fora do arquivo.

Sucesso do MVP: o sócio deixa de receber planilha por fora. Ele entra, abre o projeto em que atua e baixa o arquivo pronto para o SESC. Dá para ver quem criou o projeto, quem subiu o arquivo e qual alteração cada pessoa fez.

## 3. O que este MVP não faz

Fica explícito para não inflar a primeira versão.

- Não integra com o sistema do SESC. A subida lá continua manual, feita pelo sócio, com o arquivo baixado daqui.
- Não lê manual técnico nem normativa para inventar o custo. Na planilha do SESC, o que se preenche é o preço unitário de material e o de mão de obra de cada item. Este corte grava esses dois números. O motor que compõe o número, e como automatizá-lo, está na seção 14. Este corte não executa esse motor.
- Não cobre cliente, fornecedor, proposta comercial, cronograma de cenografia nem os outros atores do dia a dia. Isso é visão de produto, não deste corte.
- Não recria a planilha do zero e não exporta CSV “equivalente”. O arquivo que sai parte do arquivo que entrou.
- Não cria linha que não existia na planilha enviada. Dá para preencher e alterar o que já veio no arquivo. Excluir item é ação do administrador. Não dá para inventar um serviço novo.

## 4. Quem usa

Dois modos.

| Papel | O que faz | O que não faz |
| --- | --- | --- |
| Administrador | Acesso a tudo: cria projeto pelo upload, apaga linha da planilha, inclui pessoas no projeto, preenche, altera, conclui e baixa, aprova ou rejeita pedido de acesso, vê o histórico | — |
| Usuário comum | Emissão de lançamento nos projetos em que está incluído: insere e altera quantidade e valor, conclui e baixa, vê o histórico | Não cria projeto, não apaga linha, não abre o portal administrativo, não aprova acesso, não inclui nem tira pessoas do projeto |

Quem ainda não tem conta pede acesso na página pública, com nome, e-mail e celular. Só o administrador vê esse pedido. A conta só existe depois que ele aprova e a pessoa confirma o e-mail, escolhendo usuário e senha. Conta confirmada por esse caminho nasce como usuário comum.

O usuário comum existe para a emissão de lançamento. Por enquanto, só o administrador cria projeto e só ele apaga linha da planilha.

A instalação já nasce com duas contas, sem pedido e sem e-mail:

| Usuário | Senha inicial | Papel | E-mail | Celular | Situação |
| --- | --- | --- | --- | --- | --- |
| `adm` | `Administrador@001` | Administrador | nenhum | nenhum | ativo |
| `convidado` | `convidado@1` | Usuário comum | nenhum | nenhum | ativo |

O `adm` aprova os demais e entra direto no portal administrativo. O `convidado` entra direto na área comum, para lançar nos projetos em que o administrador o incluir. O esqueci a senha não se aplica a nenhuma das duas, porque não há e-mail para onde enviar o link.

## 5. Jornada

1. Na página de entrada há login e senha. Quem não tem conta pede acesso com nome, e-mail e celular. Quem esqueceu a senha pede a recuperação nesse mesmo lugar.
2. O pedido fica só para o administrador, no portal administrativo. Ele aprova ou rejeita. Se aprovar, o e-mail informado recebe um pedido para confirmar o acesso e definir usuário e senha. Só então a pessoa entra.
3. Depois de entrar, a pessoa vê os projetos em que atua. Pode haver vários. O administrador tem o botão **Criar novo projeto**. O usuário comum só abre projeto em que já foi incluído.
4. Criar novo projeto pede o nome, digitado na hora, e a data. A data pode ser informada ou preenchida com a data de hoje. Em seguida há a opção de carregar a planilha do SESC. Sem esse arquivo, a tela de preenchimento não abre.
5. Com a planilha carregada, o sistema lê aquele arquivo e monta a tela web de preenchimento: abas, blocos e itens. Descrição e unidade ficam só para leitura. Quantidade e valor ficam para preencher. Ninguém redigita a grade.
6. O administrador inclui as pessoas que vão atuar naquele projeto.
7. Cada uma entra, abre o projeto e lança quantidade e valor. Se um item não entra neste trabalho — por exemplo, um serviço de elétrica — só o administrador apaga essa linha. A exclusão vale para o arquivo final.
8. O rascunho fica salvo. Quem sair e voltar encontra o que o grupo já gravou.
9. Ao concluir, o botão **Concluir e baixar** gera o arquivo e inicia o download na hora.
10. O sócio, no mesmo projeto, baixa esse arquivo e sobe no SESC.

Um projeto é um trabalho. Outro trabalho é outro projeto, com outra planilha. A lista de itens do projeto A não aparece no projeto B.

Criar projeto não cria memorial descritivo. O memorial descritivo é outro documento da licitação, outro assunto. Ele não entra neste corte. O projeto daqui tem nome, data e a planilha comercial do SESC. A coluna B dessa planilha cita o código do memorial; a tela continua sendo a planilha, não o memorial.

## 6. Requisitos funcionais

### 6.1 Acesso

A aplicação fica na web. Sem sessão válida, a pessoa só alcança a página de entrada e as telas ligadas a ela: entrar, pedir acesso, confirmar o e-mail e recuperar a senha. Projeto, planilha e portal administrativo exigem login. A checagem de papel vale no servidor: esconder o botão não basta.

Página de entrada:

- Entrar com usuário e senha.
- Pedir acesso, para quem ainda não tem conta.
- Esqueci a senha, para quem já tem conta.

Pedir acesso pede nome, e-mail e celular. Nesse momento a pessoa ainda não escolhe usuário nem senha. O pedido fica pendente. Ela não entra no sistema.

O pedido aparece somente no portal administrativo. O administrador aprova ou rejeita.

- Rejeitado: a conta não é criada e o e-mail de confirmação não sai. O pedido permanece no histórico como rejeitado.
- Aprovado: o sistema envia um e-mail para o endereço informado no pedido. O e-mail pede que a pessoa confirme o acesso e, nessa confirmação, defina o usuário e a senha. O link é de uso único e expira. Até a confirmação, o login não funciona.

Conta confirmada entra como usuário comum. Mudar o papel para administrador é ação de quem já é administrador, no portal administrativo.

Esqueci a senha: a pessoa informa o e-mail da conta. O sistema envia um e-mail com link de uso único para ela definir uma senha nova. A senha atual não é enviada e não fica guardada de forma que alguém possa lê-la de volta. Link expirado ou já usado não troca a senha. Conta sem e-mail, como `adm` e `convidado`, não usa esse caminho.

Encerrar sessão encerra o acesso até um novo login.

A tela depois do login muda com o papel. Usuário comum não vê criar projeto nem o portal administrativo.

### 6.2 Portal administrativo

Visível só para o administrador:

- Fila de pedidos de acesso: nome, e-mail, celular, data do pedido, situação (pendente, aprovado, rejeitado).
- Aprovar ou rejeitar pedido pendente.
- Listar usuários (nome, e-mail, celular, login, papel, ativo ou inativo).
- Criar usuário com login e senha, sem esperar o e-mail de confirmação. E-mail e celular podem ficar em branco.
- Editar nome, celular e papel.
- Definir uma senha nova para um usuário existente. A senha anterior deixa de valer. A senha não fica visível.
- Ver quem foi aprovado e ainda não fez o primeiro acesso. Reenviar a notificação de confirmação. Enquanto o remetente não estiver ligado, o reenvio registra a tentativa e avisa que nada saiu: a mensagem não ficou retida em serviço nenhum.
- Excluir usuário. Ele deixa de entrar. O histórico do que ele fez permanece. Quem está na própria conta não se exclui. O único administrador ativo não é excluído nem desativado.
- Desativar usuário. Desativado não entra. Não apagar histórico do que ele fez. O `adm` da instalação não é desativado enquanto for o único administrador.

Login é único. E-mail, quando existe, é único. E-mail que já pertence a uma conta, ou a um pedido ainda pendente, não abre outro pedido. As contas `adm` e `convidado` não têm e-mail e não entram nessa fila.

### 6.3 Projetos

- Cada trabalho do SESC é um projeto, com a planilha daquele trabalho. O memorial descritivo desse trabalho é outro documento e não nasce neste botão.
- Listar os projetos em que a pessoa atua: nome, data do projeto, status, data da última alteração, quem alterou por último.
- Criar projeto, só o administrador, pelo botão **Criar novo projeto**. O formulário pede o nome, digitado na hora, e a data: informada pela pessoa ou preenchida com a data de hoje. A opção seguinte é o upload da planilha do SESC. O sistema guarda o original intacto. Com o arquivo carregado, abre a tela de preenchimento montada a partir dele. Sem o arquivo, o projeto fica só com nome e data. Ninguém redigita linha, coluna ou aba.
- No projeto, o administrador inclui e remove participantes. Participante removido deixa de abrir o projeto. O que ele já fez permanece no histórico.
- Status: **em preenchimento** e **concluído**. Concluir dispara o download. Concluir não trava o projeto: se alguém alterar de novo, o status volta para em preenchimento e uma nova conclusão gera outro download, registrado como nova versão.

### 6.4 Preenchimento

A planilha destrinchada é a tela de trabalho. Cada linha que pede número vira um item com:

- Identificação estável (aba, linha de origem, código do item, se a planilha tiver).
- Descrição do serviço, somente leitura.
- Unidade, somente leitura (m², un, vb, o que a planilha já disser).
- Quantidade, editável, quando a planilha espera quantidade. No Anexo III do Cosmo/Chão ela já vem preenchida.
- Valor, editável, quando a planilha espera valor. Nesse Anexo III são dois: preço unitário de material e preço unitário de mão de obra (seção 7).
- Total da linha, quando a planilha já calcula ou quando quantidade × valor for o que aquela célula representa. Se a célula de total for fórmula no arquivo original, o sistema não substitui a fórmula por um número colado: deixa a fórmula e preenche só as entradas.

Agrupar itens pela aba ou pelo bloco da planilha. Na tela, cada seção vira um capítulo no índice à esquerda. O capítulo com todos os valores preenchidos fica com fundo verde. O capítulo que ainda tem valor em falta fica com contorno laranja. Clicar no capítulo abre só o formulário daquela seção.

No item de serviço da cotação, o valor unitário pode receber um extra interno. A regra está na seção 6.8. Material não tem esse controle.

Salvar durante o preenchimento, sem exigir que a planilha inteira esteja completa. O que uma pessoa gravou, as outras veem no mesmo projeto.

### 6.5 Excluir item

Só o administrador exclui um item que veio na planilha. Exemplo: o arquivo trouxe um serviço de elétrica que não entra neste trabalho. Ele apaga essa linha na tela. O usuário comum vê a linha e lança nela, e a tentativa de apagar é recusada.

No arquivo final, essa linha não existe. O restante da planilha permanece: abas, cabeçalho, ordem das linhas que ficaram, formatação dessas linhas.

A exclusão não apaga o fato de o item ter existido. Ele sai da tela de preenchimento, deixa de ir para o download e fica no histórico, com quem excluiu e quando. Reincluir o item é permitido, e também fica registrado. Reincluir devolve a linha ao arquivo final, no lugar de origem.

Não se exclui aba inteira nem cabeçalho por esta ação. A ação é por item (a linha do serviço).

### 6.6 Download

O botão **Concluir e baixar**:

- marca o projeto como concluído;
- gera o arquivo a partir do original, com os valores atuais e sem as linhas excluídas;
- inicia o download nesse momento.

O arquivo gerado:

- tem a mesma extensão do enviado;
- mantém abas, cabeçalhos, mesclas e formatação das partes que ninguém excluiu;
- traz quantidade e valor nas células correspondentes;
- no item de serviço com extra, a célula de valor recebe só o valor final já calculado;
- não traz coluna, observação, comentário, percentual, margem nem qualquer texto sobre extra;
- não traz a linha de um item excluído.

O nome sugerido do download identifica o projeto e a versão, sem trocar a extensão.

Se o arquivo baixado não subir no SESC por causa de formato, aba ou extensão, o MVP não está pronto.

### 6.7 Rastreabilidade e versões

Toda ação de uma pessoa no projeto fica registrada. O histórico é visível para quem atua naquele projeto. Nada do histórico é apagado quando alguém é desativado ou removido do projeto.

Eventos mínimos:

- criou o projeto, e quem foi;
- subiu o arquivo, com o nome do arquivo;
- alterou um campo: item, campo, valor anterior, valor novo, quem, quando;
- excluiu um item: qual item, quem, quando;
- reincluiu um item: qual item, quem, quando;
- incluiu ou removeu um participante;
- concluiu e baixou: qual versão foi gerada.

Cada um desses eventos gera uma versão numerada do estado da planilha (valores preenchidos e itens excluídos). Dá para abrir a lista de versões e ver, entre uma versão e a anterior, o que mudou.

A versão atual é a que o botão Concluir e baixar usa. Uma versão antiga pode ser consultada. Restaurar uma versão antiga é ação do administrador: o estado atual passa a ser o daquela versão, e a restauração entra no histórico como versão nova. O histórico anterior não é reescrito.

### 6.8 Extra no item de serviço

Ferramenta interna de composição de preço. Vale só para o item de serviço (mão de obra, logística e as demais categorias dessa aba: pintura, acabamento, marcenaria, serralheria, comunicação visual e as outras que a planilha trouxer). Material não entra. Não é o motor da seção 14: a pessoa informa o acréscimo, o sistema não pesquisa preço.

Cada item tem o próprio extra. Ele é opcional. Um item pode ter vários. O valor base digitado ou vindo da planilha permanece guardado. O extra não substitui esse base.

Na linha do serviço há um botão **+**, com o nome Extra. Ao clicar, abre uma área de simulação daquele item: à direita, quando o cartão tem espaço; abaixo, quando não tem. A área tem borda tracejada, de rascunho. Dentro:

- o valor base atual;
- Extra em R$, no formato `R$ 0,00`, só número;
- Extra em %, no formato `0,00%`, só número;
- a prévia do valor final;
- **Aplicar** e **Cancelar**.

Dá para informar só reais, só percentual, ou os dois no mesmo extra. O percentual incide sempre sobre o valor base, nunca sobre um valor que já recebeu outro extra. Exemplo: base `R$ 100,00`, extra de `R$ 20,00` e extra de `10%` resultam em `R$ 130,00` (`100 + 20 + 10`). Dois percentuais, `10%` e `20%`, resultam em `R$ 130,00`, não em `R$ 132,00`.

Enquanto a pessoa preenche, o valor principal do formulário não muda. A tela só mostra a prévia. **Aplicar** passa o valor final a valer naquele item: totais, capítulo e o que será gravado. **Cancelar** descarta o rascunho.

Cada extra aplicado aparece compacto na linha, com lixeira. A lixeira tira só aquele extra e recalcula o final. Sem nenhum extra, o item volta ao valor base.

Um ponto discreto ao lado do **+** indica que o item tem extra. O campo de valor, nesse caso, mostra o final e não se edita por cima: a edição do base volta quando os extras saem.

Na planilha exportada, a célula original do valor do serviço recebe somente esse final. Exemplo: base `R$ 100,00`, extras `R$ 20,00` e `10%`, célula com `R$ 130,00`. Não há outra célula, nem texto, explicando a conta.

## 7. Fidelidade do arquivo

Foi citado “subir um arquivo XML”. Planilha Excel `.xlsx` é um pacote Office Open XML. O contrato do produto é este:

- O sistema aceita o arquivo daquele trabalho.
- O sistema devolve esse mesmo tipo de arquivo.
- Nada de converter para outro formato no meio do caminho.
- O original enviado permanece guardado. O download é gerado a partir dele. Uma exclusão de linha não modifica o arquivo guardado como origem; modifica o que sai na geração.

Cada projeto traz o próprio arquivo. O leitor monta a tela daquele arquivo. Não existe uma grade única reaproveitada entre projetos.

O primeiro arquivo real está na pasta do projeto: `Planilha Proposta Comercial - SESC PAULISTA - Cosmo e ChãoI.xlsx`, trabalho Exposição Cosmo/Chão, unidade SESC Avenida Paulista, processo `PE 2026012000380`. Uma aba só, de nome **Anexo III**. Outro trabalho ainda é necessário antes de tratar estas colunas como modelo universal.

Neste arquivo, a leitura é esta:

| Coluna | Papel | Na tela |
| --- | --- | --- |
| A | Número do item | Leitura |
| B | Código do memorial (`A`, `A.1`, `A.1.1`, `B.1`, `C.2.1`) | Leitura. Identifica a linha |
| C | Descrição do serviço | Leitura |
| D | Unidade (`unid`, `m2`, `m`, `pç`, `visita`, `diária`, `verba`) | Leitura |
| E | Quantidade, já preenchida pelo SESC | Editável. O motor da seção 14 não a reescreve |
| F | Preço unitário de material | Preenchimento |
| G | Preço unitário de mão de obra | Preenchimento |
| H | Total unitário, fórmula `F+G` | Fórmula, não se cola número por cima |
| I | Total de material, fórmula `E*F` | Fórmula |
| J | Total de mão de obra, fórmula `E*G` | Fórmula |
| K | Total da linha, fórmula `I+J` | Fórmula |

Linha com unidade é item que recebe preço. Linha sem unidade é grupo (`A.2` Painéis, `B` Projeto de elétrica, `C.1` Sinalização). Grupo não recebe quantidade nem preço. O total global está na linha 82: `SUM` do material e da mão de obra. Cabeçalho (processo, evento, unidade) e os recados do rodapé permanecem como estão. A data do rodapé é a fórmula `TODAY()`.

As fórmulas de H, I, J e K são fórmulas compartilhadas, num intervalo que atravessa item e grupo (por exemplo `H11:H75`). Excluir um item tira a linha e encolhe esse intervalo e o `SUM` do total. Não se converte a fórmula em número colado. Há também um total em K que continua a fórmula do total de J; a geração preserva o que o arquivo trouxe.

Campo de preço vazio no original está gravado como zero. Na tela, zero ainda não preenchido e zero digitado precisam ser distinguíveis para a pessoa. No arquivo que sai, o que já era fórmula continua fórmula.

## 8. Regras de negócio

- Um projeto tem um arquivo de origem. Substituir o arquivo é outro ato, explícito. Na primeira versão, trocar o arquivo abre uma versão nova e o preenchimento anterior permanece consultável no histórico.
- Quantidade e valor aceitam número com decimal no padrão brasileiro (vírgula) na tela. No arquivo, gravam no formato numérico que a planilha já usa.
- Extra de serviço é dado interno do preenchimento. A exportação usa o valor final e não grava o base, o percentual nem a lista de extras.
- Campo vazio permanece vazio no arquivo. Não gravar zero no lugar de “ainda não preenchido”.
- Usuário inativo perde o acesso na hora. O rastro do que ele fez permanece.
- Usuário comum não cria projeto, não apaga linha e não abre o portal administrativo, mesmo que conheça o endereço da tela. A recusa é no servidor, não só escondendo o botão.
- Pedido de acesso não autenticado não lista projetos, usuários nem outros pedidos.
- A senha não trafega de volta por e-mail. Confirmação de conta e recuperação de senha usam link de uso único, com prazo para expirar. Recuperação exige e-mail na conta.
- As contas da instalação existem desde o primeiro acesso, sem e-mail, sem pedido e sem confirmação: `adm` / `Administrador@001` entra no portal administrativo; `convidado` / `convidado@1` entra só para emissão de lançamento.
- Duas pessoas podem gravar no mesmo projeto. A gravação de um campo não apaga a gravação de outro campo feita por outra pessoa. Se as duas alterarem o mesmo campo, vale a gravação mais recente, e as duas aparecem no histórico, em ordem.

## 9. Diretriz técnica

Tudo neste corte é web. Não há app desktop nem planilha paralela como fonte da verdade.

A aplicação continua em **TypeScript**, com **Next.js** e **React**, que já estão na pasta do projeto. Uma linguagem só cobre a tela e o servidor. Trocar de linguagem não poupa a cota da Vercel: o que gasta essa cota é publicar, executar função e transferir arquivo. O esforço fica no código da aplicação. Serviço extra da plataforma só entra se o código não der conta.

Usuários, versão, fila de entregas, logs e saúde do ambiente são a operação da aplicação. Qualquer sistema pode ter essa camada. O escopo do Heladri permanece o da seção 1: a planilha de licitação do SESC. O catálogo da esteira lista só os passos deste portal. Até o Supabase existir, essa operação grava num arquivo local da máquina, fora do Git.

O gerador parte do pacote original, aplica valores e remove as linhas excluídas. Não monta um arquivo novo a partir de linhas soltas. Ler a planilha, checar o papel no servidor, guardar versão e gerar o arquivo de volta são código deste portal.

### 9.1 Onde cada coisa mora

| Peça | Onde fica | O que não usamos no lugar |
| --- | --- | --- |
| Código | Git | A Vercel não é o lugar onde o código é editado |
| Banco | Postgres do Supabase, na nuvem | Banco local, banco da Vercel |
| Arquivo original da planilha e os arquivos gerados que precisem ficar guardados | Storage do mesmo projeto Supabase | Blob ou disco da Vercel |
| Aplicação no ar | Vercel, publicada a partir do Git | Deploy manual, preview a cada salvamento |
| Desenvolvimento | Máquina local | A Vercel, enquanto se está construindo |
| Segredo de conexão | Painel do Supabase, lido na subida do processo local | Código, Git, imagem Docker, navegador |

Um único projeto Supabase na nuvem serve o desenvolvimento e a primeira publicação. Não há Postgres na máquina. O que o ambiente local grava é dado desse projeto. Separar um projeto só de produção fica para quando houver uso fora de quem está construindo.

Usuários, pedidos de acesso, projetos, participantes, versões e o arquivo de origem persistem nesse Supabase. A autenticação continua regra da aplicação: usuário e senha, os dois papéis, aprovação do administrador, links de uso único e senha que não volta por e-mail. Os dados dessa regra ficam no Supabase. Não se adota um produto de login da Vercel.

O envio do e-mail de confirmação e o de recuperação de senha ainda não têm remetente escolhido. Esse remetente não é um add-on da Vercel. A escolha entra nos próximos passos, desde que o e-mail cumpra o que as seções 6 e 8 já pedem.

### 9.2 Desenvolvimento local

O ciclo de construir e testar roda na máquina. Nada disso publica na Vercel.

O caminho fechado é um container **Docker** que sobe o Next.js e aponta para o Supabase na nuvem. Vale o equivalente mais leve: o servidor local do Next.js (`pnpm dev`) com as mesmas variáveis de ambiente. Os dois poupam a Vercel pelo mesmo motivo: não fazem deploy.

### 9.3 Conexão com o banco, sem senha no código

A senha do Postgres não entra no código, no Git, na imagem Docker nem no navegador. Ela permanece no painel do Supabase, na conta da esteira. O portal não abre uma URL `postgres://` com usuário e senha.

Quem fala com o banco é o processo do servidor, pela API HTTPS do próprio Supabase. O navegador fala só com o Next.js. Isso vale no desenvolvimento: o login deste MVP é usuário e senha da aplicação, então o browser não recebe chave de banco para consultar o Supabase direto.

O painel entrega duas chaves. O código lê as duas por variável de ambiente, na subida do processo:

| Chave | Variável | Onde pode aparecer |
| --- | --- | --- |
| URL do projeto | nome no `.env.example`, valor só no arquivo local | Servidor |
| Chave secreta (service role) | nome sem prefixo `NEXT_PUBLIC_` | Só o servidor. Ela atravessa a política de linha do Supabase, então a checagem de papel continua no código, antes da consulta |
| Chave publicável (anon) | reservada, sem uso no navegador neste corte | Não vai para o bundle. Prefixo `NEXT_PUBLIC_` publicaria o valor no browser, e este corte não faz isso |

No desenvolvimento, os valores ficam em `.env.local`, ignorado pelo Git. A pessoa copia do painel do Supabase para esse arquivo, na própria máquina. O Docker recebe o mesmo arquivo na hora de rodar (`env_file`). O build da imagem não copia o arquivo para dentro da imagem: um `docker history` não pode mostrar a chave.

O repositório versiona `.env.example` só com os nomes, vazios, e um `.gitignore` que cobre `.env`, `.env.local` e `.env*.local`. Chave não se cola em código, em commit, em print de tela compartilhado nem em issue.

Quando a publicação existir, os mesmos nomes são preenchidos nas variáveis do projeto na Vercel. O repositório continua sem valor. Isso fica para o passo em que o Git for ligado à Vercel, não para o dia a dia do desenvolvimento.

### 9.4 Publicação e conta da esteira

Em produção, a aplicação roda na **Vercel**. O deploy é o da própria Vercel: o Git envia o código e ela publica. Não há servidor próprio nem container no ar. O plano é o gratuito. O Docker fica só na máquina de quem desenvolve. Para a cota durar:

- desenvolvimento não dispara deploy;
- não se abre Postgres, Blob, KV, cron nem otimização de imagem da Vercel — a imagem do Next.js já está sem essa otimização;
- não se liga produto extra da Vercel enquanto o código e o Supabase resolverem o caso;
- o arquivo da planilha não transita por armazenamento da Vercel.

A conta que cria e liga Supabase, Vercel e o repositório Git é **heladriapp@gmail.com**, já autenticada no navegador. Segredo dessa conta não entra neste documento. A grafia saiu da fala «Eladriepp arroba gmail.com»; confirmar o endereço antes de criar os projetos.

O diretório Heladri já tem Git próprio, ainda sem commit e sem remoto. O remoto precisa ser um que a Vercel ligue por Git; com essa conta Google, o caminho prático é o GitHub. Esse passo não trava o corte da planilha.

## 10. Critérios de aceite

1. Sem login, nenhuma tela de projeto ou do portal administrativo abre. A página de entrada mostra login, pedir acesso e esqueci a senha.
2. O usuário `adm`, com a senha `Administrador@001`, entra no portal administrativo sem e-mail e sem pedido de acesso. Esqueci a senha não se aplica a essa conta.
3. O usuário `convidado`, com a senha `convidado@1`, entra sem e-mail e sem pedido de acesso. Vê a área comum de lançamento. Não vê criar projeto, não apaga linha e não abre o portal administrativo. Acesso direto a essas ações é recusado.
4. Uma pessoa pede acesso com nome, e-mail e celular. Só o administrador vê o pedido. Antes da aprovação, esse e-mail não entra.
5. Administrador aprova. Chega um e-mail no endereço do pedido. A pessoa confirma, define usuário e senha, e entra como usuário comum. Ela não vê criar projeto, não apaga linha e não abre o portal administrativo. Acesso direto a essas ações é recusado.
6. Administrador rejeita outro pedido. Esse e-mail não recebe confirmação e não entra.
7. Esqueci a senha, para conta que tem e-mail, envia um link para definir senha nova. O e-mail não contém a senha atual. Link vencido ou já usado não altera a senha.
8. Usuário desativado não entra. O `adm` da instalação não é desativado enquanto for o único administrador.
9. Administrador cria um projeto com nome, data e upload da planilha do SESC. A data pode ser a de hoje. A tela de preenchimento nasce com os itens daquele arquivo, sem digitação da grade. Sem o arquivo, essa tela não abre. O histórico registra quem criou e quem subiu o arquivo. O `convidado` não cria projeto.
10. Um segundo projeto, com outra planilha, não mistura itens com o primeiro.
11. Usuário comum incluído no projeto lança quantidade e valor. Ao sair e entrar, os números continuam. O histórico mostra valor anterior, valor novo e quem alterou.
12. Administrador exclui o item de elétrica. O item some da tela. No arquivo baixado, a linha não está. As outras linhas permanecem. O histórico mostra a exclusão. O usuário comum não consegue apagar essa linha.
13. Reincluir o item, feito pelo administrador, devolve a linha ao arquivo da próxima conclusão, com registro no histórico.
14. Duas pessoas no mesmo projeto veem o mesmo preenchimento. Alterações em campos diferentes se acumulam. Alteração no mesmo campo fica com a mais recente e com as duas no histórico.
15. **Concluir e baixar** inicia o download na hora. O arquivo abre no Excel (ou no programa que o SESC usa) com a mesma extensão, as mesmas abas e a formatação das linhas que ficaram, números nas células certas, fórmulas que já existiam continuam fórmulas.
16. A lista de versões mostra cada alteração. Restaurar uma versão antiga, feito pelo administrador, volta os valores e as exclusões daquele ponto e registra a restauração sem apagar o histórico.
17. Usuário comum que não está no projeto não abre esse projeto.

## 11. Pendências que travam a implementação

O leitor deste modelo já tem coluna marcada, na seção 7. Continua travando o leitor genérico:

1. Um **segundo arquivo** de outro trabalho do SESC, para ver se a aba, as colunas e o intervalo de fórmulas se repetem. Sem isso, o leitor não trata o Anexo III do Cosmo/Chão como grade de todos os trabalhos.
2. Confirmar se a extensão que o SESC aceita na subida é este `.xlsx`.
3. Na exclusão, conferir no Excel o intervalo compartilhado depois de tirar uma linha do meio (item de elétrica, por exemplo) e o `SUM` do total global. A regra está na seção 7; o teste com o arquivo aberto ainda não foi feito.

## 12. Visão depois deste corte

O destino maior está em `docs/prd_avancado.md`: um sistema operacional de projetos de cenografia e arquitetura promocional, do documento bruto até a execução e o histórico da obra. Este MVP não implementa esse documento. Ele segura o primeiro trecho, para o resto poder encaixar sem refazer o acesso nem o arquivo do SESC.

Fica para depois, e só começa quando o arquivo baixado for aceito pelo SESC:

- leitura de PDF, planta, memorial e referência visual;
- classificação por disciplina e quantitativo com fonte;
- separação entre fato, valor calculado, inferência e pendência;
- base de preços reutilizável, com cotação datada, sem substituir número digitado pela pessoa;
- custo por disciplina, planejamento de fabricação, cronograma, equipe e dashboard;
- obras já executadas como referência de preço, prazo e equipe.

A planilha oficial do SESC continua um arquivo de entrada e saída fiel. A referência de como o valor nasce, neste trabalho, é o motor da seção 14. Ele orienta o preenchimento. Não gera outra planilha no lugar da que o SESC enviou.

## 13. Próximos passos da esteira

A ordem abaixo é a fila que o portal mostra em Implantações e na Esteira, depois da operação 0.1.0. Aprovar uma entrega libera desenvolver aquele passo. Não publica sozinho e não cria conta de serviço.

O extra no item de serviço (seção 6.8) já estava aprovado e passou à frente de Git, Supabase, e-mail e Vercel. Entrou nesta versão, 0.6.0. A fila seguinte continua no repositório e na nuvem.

O corte razoável do MVP, antes de Git, Supabase, e-mail e Vercel, é ver a planilha funcionar nesta máquina:

1. Depois do login, a lista dos projetos da pessoa.
2. **Criar novo projeto**: nome digitado, data informada ou data de hoje, e a opção de carregar a planilha do SESC.
3. Com o arquivo carregado, a tela web de preenchimento. Quantidade, valor, concluir e baixar vêm no passo seguinte da mesma fila. Até o Supabase existir, projeto e arquivo ficam no armazenamento local, como a operação da 0.1.0.

Git e Supabase continuam aprovados para desenvolver. Eles não passam na frente desse corte.

4. Confirmar se o e-mail da esteira é `heladriapp@gmail.com`.
5. Versionar o Heladri num remoto que a Vercel consiga ligar, na conta acima. O caminho prático é o GitHub.
6. Criar o projeto no Supabase com essa conta. Copiar URL e chave secreta para `.env.local` na máquina. Não anotar esses valores no repositório.
7. Subir a aplicação na máquina lendo esse arquivo. Provar que o servidor alcança o Supabase e que o navegador não recebe a chave.
8. Escolher o remetente do e-mail de confirmação e do esqueci a senha, fora da Vercel, cumprindo as seções 6 e 8.
9. Ligar o repositório à Vercel com a mesma conta. O primeiro deploy espera o fluxo local de pé. Deploy seguinte sai do Git, não do experimento do dia.
10. O leitor do Anexo III do Cosmo/Chão já tem coluna marcada na seção 7. Um segundo trabalho do SESC continua necessário, seção 11, antes de generalizar. A esteira não substitui esse segundo arquivo.
11. O motor de cotação, seção 14, fica para o corte seguinte. Não entra no primeiro deploy.

## 14. Motor de cotação

O arquivo `planilha_cotacao_cosmochao-v14.xlsx` é a lógica de cálculo dos valores que devem entrar na planilha do SESC deste trabalho. As abas se apresentam como v12.0; o nome do arquivo é a referência. É o concreto do que `docs/prd_avancado.md` chama de base de preços, status e cálculo automático. Não é a planilha que volta para o SESC.

Seis abas. As três que calculam:

| Aba | O que guarda | Conta |
| --- | --- | --- |
| Cotação de Materiais | Insumo com código (`MAT-01`, `ELE-04`, `CV-01`), disciplina, quantidade, unidade, custo unitário, status e onde se aplica | Total da linha = quantidade × custo unitário. Total da aba = soma dessas linhas |
| Mão de Obra e Serviços | Função ou logística (marceneiro, empreita, limpeza, alimentação, deslocamento, frete, ART, manutenção), quantidade, unidade, valor unitário, status | Mesma conta. Inclui `pessoas × dias × valor` de alimentação e de deslocamento |
| Resumo por Disciplina | Uma linha por disciplina | Soma os totais de material daquela disciplina e a parte que isso representa no material |

O total geral da capa é o total de material mais o total de mão de obra e logística. As outras abas (instruções, dashboard, cronograma) leem essas três. Não são outra fonte de preço.

O status de cada linha do motor, neste arquivo: **EXPLÍCITO**, **DERIVADO**, **PENDENTE**, **DIVERGENTE**, **FECHADO**, **REFORMADO**. Preço que a pessoa fechou permanece. O motor não troca um valor fechado por outro pesquisado.

### O que a automação precisa resolver

Não há fórmula ligando `A.2.1` da planilha do SESC a `MAT-01` do motor. O vínculo de hoje é texto na coluna «Aplicação / Local» (P05, M22, painéis P01–P07). Um insumo entra em vários itens do SESC. Um item do SESC come vários insumos: um painel é chapa, pontalete, tinta e uma fatia da mão de obra.

Automatizar é guardar o motor como dado do projeto e fazer o rateio:

1. Cada insumo e cada mão de obra declara de quais códigos do memorial participa (`A.2.1`, `B.1`, `C.2.1`), em vez de só uma frase.
2. O material rateado para o item, dividido pela quantidade da coluna E, vira o preço unitário de material (coluna F).
3. A mão de obra rateada para o item, dividida pela mesma quantidade, vira o preço unitário de mão de obra (coluna G).
4. H, I, J e K continuam fórmula do arquivo do SESC. O motor não cola total por cima delas.
5. A quantidade da coluna E permanece a do SESC. O motor não a reescreve.

Neste par de arquivos as quantidades já divergem em alguns itens (extintor, bloco de emergência, cabo). A automação mostra a divergência. Não escolhe um dos dois números sozinha.

Enquanto o rateio não existir, F e G continuam digitados na tela, como a seção 6.4 descreve. O primeiro corte não importa o motor nem sugere preço. O desenho da linha do SESC, porém, já separa material e mão de obra, que é o par que o rateio vai preencher.
