# Plano de correção funcional — J0 a J5

Data: 22/08/2026  
Escopo: Nexus Printi (loja) + Flow Printi (CRM), achados A-01 a A-30 da auditoria por jornada.  
Ambiente de implementação: espelho local do banco real. Produção permanece sem escrita até
aprovação explícita do pacote de implantação.

## Objetivo

Entregar um fluxo único e verificável para catálogo, compra online, orçamento, balcão e revenda.
“Corrigido” significa que interface, regra de negócio e banco produzem o mesmo resultado; toast
ou mudança visual sem registro operacional não contam como sucesso.

## Decisões arquiteturais

1. `store` será o domínio canônico de catálogo, clientes, orçamentos, pedidos, pagamentos,
   produção, estoque, crédito e comissões.
2. Flow e Nexus serão duas interfaces do mesmo domínio. `public.orders` não será mais uma
   segunda verdade operacional; quando necessário, será projeção de leitura/compatibilidade.
3. Todo pedido — web, orçamento convertido, balcão ou revenda — usará uma única operação
   transacional. Cabeçalho, itens, pagamento, financeiro, produção, estoque, crédito e comissão
   serão confirmados juntos ou sofrerão rollback juntos.
4. Autorização será baseada em vínculo real: cliente, revendedor, vendedor/atendente, admin e
   membro de empresa. Ser autenticado não será suficiente para acessar dados de terceiros.
5. Créditos serão um razão imutável com saldo calculado no banco. Limite faturado e saldo de
   crédito não serão tratados como a mesma coisa.
6. Valores exibidos por catálogo, calculadora, orçamento, carrinho e pedido usarão o mesmo motor
   de preço e o mesmo snapshot de cálculo.
7. Funções privilegiadas terão `search_path` fixo, grants mínimos, validação de identidade e
   teste de RLS. Nenhuma chave `service_role` irá ao navegador.

## Definição global de pronto

- banco novo reconstrói o schema apenas pelas migrações, sem SQL manual;
- migrações têm versões únicas, aplicam em ordem e também aplicam sobre o espelho de produção;
- nenhuma Server Action ignora erro de persistência em etapa obrigatória;
- cada mutação crítica é idempotente e auditável;
- RLS passa por testes positivos e negativos para P1, P2, P8, P9, P10 e anônimo;
- `lint`, typecheck, builds e testes automatizados passam nos dois projetos;
- J1–J5 são repetidas do zero, sem triggers ou inserts de contorno;
- deploy possui backup, ensaio, checklist de verificação e rollback.

## Ordem de execução

### Fase 0 — Congelamento, inventário e baseline

Achados: A-01 e suporte a todos os demais.

- preservar as alterações locais existentes e separar o trabalho por commits/pacotes;
- transformar o dump de produção em fixture de ensaio reproduzível;
- corrigir versões duplicadas das migrações `20260816000000` e `20260816000001` antes de usar o
  histórico oficial;
- reconciliar `schema_migrations` com os objetos reais, sem marcar migração como aplicada antes
  de validar seus efeitos;
- criar um script único `verify-j0-j5` com consultas invariantes e saída não ambígua;
- registrar baseline de RLS, triggers, funções, buckets e contagens antes de cada pacote.

Critério de saída: banco vazio e espelho de produção chegam ao mesmo schema esperado; o ensaio
é repetível e não escreve em produção.

### Fase 1 — Fundação do banco e identidade

Achados: A-01, A-02, A-05, A-06, A-07, A-15, A-18 e base de A-24.

- consolidar e testar as migrações já escritas de numeração, automações de pedido e
  estoque/crédito;
- criar perfis de forma atômica no cadastro Nexus e Flow; em falha, não deixar usuário Auth
  órfão;
- criar modelo de membros da empresa (`company_members`) com papéis e políticas por operação;
- trocar `user_owns_company()` por autorização que aceite dono e membros autorizados;
- criar bucket privado `artes`, policies de upload/leitura e limites de tamanho/tipo;
- restaurar a infraestrutura completa de orçamento: número, token, validade, histórico e
  operações públicas seguras;
- garantir grants explícitos do schema `store` para a Data API, separados de RLS.

Critério de saída: cadastros criam perfis válidos, P2 opera como atendente sem virar dono,
documentos recebem número e arte pode ser armazenada com isolamento por pedido.

### Fase 2 — Operação canônica de pedido e integração Flow/Nexus

Achados: A-03, A-08, A-16, A-19, A-20 e A-22.

- criar uma operação transacional única de pedido com validação server-side e idempotency key;
- migrar checkout Nexus, conversão de orçamento e pedido de balcão para essa operação;
- fazer o Flow criar/editar produtos no catálogo canônico ou publicar por sincronização
  explícita com log e estado de erro;
- fazer Orçamentos do Flow ler/escrever `store.quotes`;
- transformar a visão de pedido do Flow em leitura do pedido canônico;
- criar pagamento e lançamento financeiro reais, nunca apenas trocar `payment_status`;
- gerar OPs/itens de produção e reservas/baixas de estoque conforme ficha técnica;
- tornar mensagens de sucesso dependentes do commit completo.

Critério de saída: o mesmo UUID e número aparecem no Flow e Nexus; qualquer falha intermediária
devolve erro e não deixa pedido parcial.

### Fase 3 — J1 e J2: catálogo e compra online

Achados: A-03 a A-13.

- corrigir o formulário de produto para manter estado das abas e enviar payload completo;
- publicar produto do Flow na loja e verificar slug, imagens, faixas e disponibilidade;
- validar upload pelo conteúdo real do arquivo (magic bytes), extensão, MIME e tamanho;
- corrigir ações administrativas que hoje retornam HTTP 500 e preservar erros do framework;
- implementar logout real com invalidação da sessão e redirecionamento;
- tratar datas `date` como data civil, sem conversão UTC que recue um dia;
- criar notificações persistentes e outbox de e-mail para pedido, pagamento, arte e status;
- adicionar `max_quantity` por produto e validação server-side de capacidade;
- garantir recibo e histórico do pedido após confirmação.

Critério de aceite J1: produto criado/editado no Flow aparece corretamente na vitrine Nexus e
suas alterações propagam com auditoria.

Critério de aceite J2: P9 cria conta, compra, paga, envia arte válida, recebe notificações,
acompanha status e sai da conta; arquivos executáveis e quantidades acima do limite são
rejeitados pelo servidor.

### Fase 4 — J3: orçamento que vira venda

Achados: A-06, A-11 e A-14 a A-17.

- aceitar solicitação anônima por endpoint server-side validado, com rate limit e proteção
  antispam, sem abrir insert genérico por RLS;
- atribuir vendedor e criar oportunidade no mesmo domínio usado pelo Flow;
- gerar proposta com token forte, validade e snapshot imutável dos valores;
- validar status e `valid_until` no servidor/banco em toda leitura e resposta;
- tornar resposta idempotente: somente uma transição terminal, com histórico único;
- converter proposta aprovada pela operação canônica de pedido;
- invalidar ou reduzir a resposta pública após conversão/expiração sem expor dados sensíveis.

Critério de aceite J3: P10 solicita, P2 atende, P1 acompanha, P10 abre/decide e a proposta
aprovada vira exatamente um pedido Nexus/Flow com os mesmos itens e valores.

### Fase 5 — J4: balcão/POS

Achados: A-18 a A-23.

- criar tela de venda de balcão no Flow com cliente opcional/“Consumidor balcão”;
- permitir busca de catálogo, quantidade, preço autorizado, desconto, prazo e retirada;
- cadastrar produto/setor/ficha de produção de fotografia ou permitir item avulso controlado,
  sempre com preço unitário, responsável e justificativa;
- registrar método de pagamento, valor recebido, identificador da transação, operador e horário;
- implementar abertura/fechamento e movimentos de caixa;
- gerar recibo interno imprimível; documento fiscal fica fora do escopo até integração fiscal
  ser contratada;
- criar OP, reservar/baixar insumos e registrar cada transição de produção;
- registrar retirada com operador, data/hora e confirmação do cliente.

Critério de aceite J4: P2 vende 50 fotos para P10 sem e-mail, recebe PIX, imprime recibo, envia
para produção, baixa insumo e entrega; todos os eventos aparecem no mesmo pedido em Flow/Nexus.

### Fase 6 — J5: revenda

Achados: A-24 a A-30 e recorrência de A-06.

- exigir preço de revenda configurado ou tabela atribuída; remover fallback silencioso para o
  preço público quando a tela promete vantagem comercial;
- fazer catálogo e calculadora chamarem o motor real por produto + quantidade + perfil;
- usar tabelas de margem somente para preço de venda ao cliente final;
- permitir selecionar cliente final no checkout e gravar `customer_id`/snapshot de faturamento;
- implementar razão de crédito transacional, trava de saldo negativo e idempotência;
- separar compra com saldo, compra faturada contra limite e demais meios de pagamento;
- concluir/aprovar/recusar a solicitação quando o admin decidir o limite;
- gerar comissão prevista para P8 no evento definido e atualizar estado no faturamento/pagamento;
- manter admin e revendedor lendo a mesma linha de comissão;
- publicar e testar materiais comerciais, respeitando whitelabel e URLs assinadas.

Critério de aceite J5: P8 vê custo correto e menor que o público, calcula margem, seleciona o
cliente, compra uma única vez com saldo/limite, vê o saldo baixar, recebe comissão idêntica à do
admin e baixa material autorizado sem acesso a custo interno da gráfica.

### Fase 7 — Segurança, regressão e implantação

- testes unitários do motor de preço, datas, arquivos, crédito e comissão;
- testes SQL de constraints, triggers, concorrência, idempotência e saldo negativo;
- matriz RLS com acesso permitido e negado por persona;
- testes E2E completos J1–J5 em navegadores separados;
- builds de produção dos dois projetos e verificação visual das rotas alteradas;
- advisors de segurança/performance, revisão de funções privilegiadas e grants;
- ensaio de migração sobre cópia recente de produção, medição de locks e plano de rollback;
- implantação em duas etapas: banco compatível retroativamente, depois aplicações;
- smoke test pós-deploy e monitoramento de pedidos, pagamentos, créditos e erros.

## Matriz dos achados

| Achado | Fase principal | Correção verificável |
|---|---:|---|
| A-01 | 0–1 | histórico reconstrói banco vazio e converge com produção |
| A-02 | 1 | cadastro Flow cria perfil/empresa ou reverte Auth |
| A-03 | 2–3 | publicação Flow chega a `store.products` e à vitrine |
| A-04 | 3 | produto salva todas as abas num payload validado |
| A-05 | 1 | cadastro Nexus cria Auth + perfil + cliente atomicamente |
| A-06 | 1 | triggers/defaults geram números únicos para documentos |
| A-07 | 1–3 | bucket/policies existem e upload só confirma após persistir |
| A-08 | 2–3 | ações admin executam e reportam erro de domínio, sem 500 genérico |
| A-09 | 3 | servidor rejeita PE disfarçado e aceita PDF/imagem válidos |
| A-10 | 3 | logout remove sessão/cookies e rota privada redireciona |
| A-11 | 3–4 | datas civis preservam o dia em todas as telas |
| A-12 | 3 | eventos geram notificação e outbox de e-mail |
| A-13 | 3 | limite por produto é aplicado no cliente e servidor |
| A-14 | 4 | solicitação pública válida grava sem policy anônima ampla |
| A-15 | 1–4 | infraestrutura de orçamento completa e versionada |
| A-16 | 2–4 | Flow e Nexus usam o mesmo orçamento/oportunidade |
| A-17 | 4 | token vencido ou já decidido não lê/responde novamente |
| A-18 | 1–5 | membro atendente opera empresa com RLS por permissão |
| A-19 | 2–5 | balcão cria pedido canônico completo |
| A-20 | 2–5 | PIX gera pagamento, financeiro e caixa auditáveis |
| A-21 | 5 | pedido de balcão gera recibo interno |
| A-22 | 2–5 | sucesso somente após criar produção/financeiro reais |
| A-23 | 5 | catálogo/itens controlados suportam fotografia e insumos |
| A-24 | 1, 6 | débito e saldo são atômicos, concorrentes e idempotentes |
| A-25 | 6 | tabela/preço de revenda real e menor que o público |
| A-26 | 6 | calculadora usa a mesma faixa do checkout |
| A-27 | 6 | pedido gera comissão prevista de P8 |
| A-28 | 6 | checkout seleciona e vincula cliente final |
| A-29 | 6 | decisão do limite encerra a solicitação |
| A-30 | 6 | materiais reais publicados e download autorizado |

## Entradas comerciais necessárias antes de produção

O código pode ser construído e testado localmente sem estas respostas, mas o deploy final exige:

1. tabela/desconto real de revenda por produto ou faixa;
2. momento da comissão: pedido, faturamento ou pagamento — recomendação: criar como `previsto`
   no pedido, aprovar no faturamento e marcar pago somente na liquidação;
3. política de limite faturado, vencimento e bloqueio por inadimplência;
4. produto/ficha de fotografia 10x15 e insumos consumidos;
5. definição se o recibo de balcão será apenas interno ou integrado a emissão fiscal;
6. arquivos reais de catálogo, mockups e artes, com classificação whitelabel;
7. provedor SMTP/transacional para envio externo das notificações.

## Estratégia de entrega

Cada fase será entregue como pacote pequeno, com migração, código, testes e evidência. Não haverá
um único deploy “big bang”. O primeiro pacote de produção só será preparado depois de as fases
0 e 1 passarem integralmente no banco vazio e no espelho do banco real.
