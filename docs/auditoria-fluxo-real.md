# Auditoria por jornada — Nexus Printi (loja) + Flow Printi (CRM)

Data: 19–22/08/2026 · Banco real: `gkbbzypdakjrvxwvfjlc` (produção) · **Ambiente de execução das
jornadas: espelho local** (Docker + `supabase start`), construído a partir de um dump real do
schema de produção — não por replay das migrações versionadas, que não reconstrói o banco do
zero (ver A-01 abaixo). Este relatório substitui `docs/auditoria-fluxo-real.md` de 16/08/2026;
os achados daquele documento (A-01 a A-21) foram todos re-confirmados ou herdados aqui.

**Método:** consulta read-only direta a produção para linha de base e schema; todas as escritas
de teste (contas, pedidos, orçamentos) rodam no espelho local, nunca em produção.

## Resumo único dos achados

| ID | Gravidade | Tipo | Jornada | O que acontece | Onde | Como reproduzir |
|---|---|---|---|---|---|---|
| A-05 | P0 | Bug | J2 | Cadastro da loja cria usuário no Auth sem perfil/cliente e entra em loop de redirecionamento | `auth.ts:57-105` + trigger `on_auth_user_created_store` ausente | Criar conta em `/cadastro` no banco atual |
| A-06 | P0 | Bug | J2 / J3 | Checkout e conversão de orçamento não criam pedido porque `store.orders.number` é obrigatório e não recebe valor | `orders.ts:318-355` + `quotes.ts:294-318` + `store.orders.number` | Confirmar checkout ou converter proposta aprovada |
| A-07 | P0 | Bug | J2 | Bucket privado `artes` não existe; upload falha e a tela ainda mostra toast de sucesso | `0004_storage.sql:10-57` + `art-uploader.tsx:93-131` | Enviar arte pelo detalhe do pedido |
| A-08 | P0 | Bug | J2 | Toda ação do detalhe administrativo do pedido retorna HTTP 500 | `production.ts:1,268` + loader de Server Actions | Confirmar pagamento em `/admin/pedidos/[id]` |
| A-14 | P0 | Bug | J3 | Formulário público de orçamento nunca grava: a policy de `store.quotes` rejeita o visitante anônimo | `content.ts:87-117` + `store_rls.sql:564-570` | Enviar `/orcamento` sem login; REST retorna `42501` |
| A-15 | P0 | Bug | J3 | Subsistema de orçamento em `store` ficou sem numeração, geração de token e RPCs públicos; criar, enviar e abrir proposta quebram em etapas diferentes | `unify_store_schema.sql:736-766` + `quotes.ts:108-180` + RPCs ausentes | Criar orçamento com P2, enviar e abrir `/proposta/[token]` |
| A-16 | P0 | Integração | J3 | Nexus grava `store.quotes`, enquanto o Flow lê `public.quotes`; a solicitação da loja não aparece no CRM nem gera oportunidade | `config.ts:14-18` + `_app/orcamentos.tsx:147-160` + `content.ts:45-136` | Criar dado em `store.quotes` e abrir Orçamentos no Flow |
| A-18 | P0 | Permissão / ausência | J4 | O Flow não tem papel de atendente: P2 entra, mas sem perfil/empresa não grava; mesmo com perfil, a RLS aceita só o dono da empresa | `_app/clientes.tsx:91-104` + `user_owns_company()` + policies de `clients/orders` | Entrar no Flow como P2 e tentar criar cliente/pedido |
| A-19 | P0 | Integração | J4 | Pedido manual nasce apenas em `public.orders`; não chega ao Nexus/`store.orders` nem cria item, OP, pagamento, financeiro ou estoque | `_app/pedidos.tsx:72-99` + `fix_sync_depth_guard.sql:90` | Criar pedido manual e consultar os dois schemas |
| A-24 | P0 | Financeiro / bug | J5 | Crédito interno paga o pedido, mas não gera débito nem reduz o saldo; o mesmo crédito pode ser reutilizado | `orders.ts:282-293,407-414` + triggers ausentes em `store.credits` | Comprar com crédito e comparar pedido, extrato e `profiles.credit_balance` |
| A-09 | P1 | Risco | J2 / ataques | Executável renomeado para `.pdf` é aceito e entregue à equipe como arte | `art-uploader.tsx:44-52` + `art.ts:36-64` | Renomear um PE para `.pdf` e enviá-lo |
| A-10 | P1 | Bug | J2 / sessão | “Sair da conta” fecha o menu, mas não encerra a sessão nem faz requisição | `account-menu.tsx:117-123` | Usar o menu da conta no painel do cliente |
| A-02 | P1 | Bug | J0 | Cadastro público do CRM cria conta órfã, sem empresa nem perfil | `signup.tsx:31-38` + trigger ausente | Criar conta em `/signup` e consultar `public.profiles` |
| A-17 | P1 | Segurança / regra | J3 / ataques | RPC público aceita proposta vencida; a validade é checada só na tela e pode ser contornada por chamada REST anônima | `0002_functions.sql:655-679` + `proposta/[token]/page.tsx:60-62` | Chamar `respond_public_quote` para token com `valid_until` passado |
| A-20 | P1 | Financeiro / ausência | J4 | “Receber PIX” é somente mudar `payment_status` para `pago`; não há método, transação, comprovante, operador, horário nem caixa | `_app/financeiro.tsx:30-65,180-213` | Marcar PED-000002 como Pago no Financeiro |
| A-21 | P1 | Ausência | J4 | Pedido de balcão não tem recibo/comprovante; a URL de comprovante do Nexus responde 404 porque o pedido não existe em `store` | Flow sem ação de recibo + `/painel/pedidos/[id]/comprovante` | Abrir comprovante com o UUID do pedido manual |
| A-22 | P1 | Bug / ausência | J4 | Toast afirma que Produção e Financeiro foram atualizados, mas dashboard/PCP ficam zerados; arrastar o cartão também não muda o status | `_app/pedidos.tsx:81-99` + `_app/producao.tsx:49-89,118-137` | Criar pedido manual e abrir Produção |
| A-25 | P1 | Comercial / configuração | J5 | O preço efetivo do revendedor é idêntico ao público: não há preço de revenda nas faixas nem tabela comercial atribuída | `pricing.ts:221-224` + `product_price_tiers.reseller_unit_price` nulo | Comparar o mesmo produto/quantidade sem login e como P8 |
| A-26 | P1 | Precificação / bug | J5 | Catálogo e calculadora do revendedor ignoram faixas: mostram custo de R$ 0,15 quando o checkout cobra R$ 0,22 | `revenda/produtos/page.tsx:84-87` + `margin-calculator.tsx:44-50` | Calcular 100 unidades e comparar com a página do produto |
| A-27 | P1 | Comissão / ausência | J5 | Pedido de P8 não gera sua comissão de 10%; a criação contempla somente `seller_profiles` e papel vendedor | `orders.ts:453-470` | Finalizar pedido como revendedor e consultar `store.commissions` |
| A-01 | P2 | Risco | J0 | Histórico de migração não reconstrói o banco do zero | `20260601000000_initial_schema.sql` | Reexecutar as migrações em banco vazio |
| A-03 | P2 | Ausência | J1 | Produto publicado no CRM não chega ao catálogo nem à vitrine da loja | `product-editor.tsx:441-485` + `site_products_view.sql:19-50` | Criar produto ativo no CRM e consultar `store.products` |
| A-04 | P2 | Bug | J1 | Formulário da loja envia somente a aba visível; produto não pode ser criado nem editado por completo | `product-form.tsx:72-193,345-449` + `admin.ts:211` | Preencher Básico e Preços, ir a Publicação e salvar |
| A-11 | P2 | Bug | J2 / J3 | Prazo e validade `date` perdem um dia ao serem formatados na loja e no CRM | `format.ts:61-69` + `_app/pedidos.tsx:200` | Gravar `2026-08-27` e abrir: aparece `26/08` |
| A-12 | P2 | Ausência | J2 | Pedido, pagamento e arte não geram notificação nem e-mail transacional | `orders.ts:318-498,505-577` + `art.ts:73-148` | Finalizar/avançar pedido e consultar notificações/Mailpit |
| A-13 | P2 | Risco | J2 / ataques | Loja aceita quantidade de 1.000.000 sem limite ou checagem de capacidade | configurador do produto + `cart.ts` | Digitar `1000000` no configurador |
| A-23 | P2 | Ausência | J4 | Sem produto/preço/setor fotográfico, P2 inventa a descrição, o total e classifica 50 fotos como “Sublimação”; não há baixa de insumo | `_app/pedidos.tsx:222-280` + catálogo/estoque | Cadastrar 50 fotos 10x15 no pedido manual |
| A-28 | P2 | Revenda / ausência | J5 | Cliente final cadastrado pelo revendedor não pode ser escolhido no checkout; o pedido fica sem `customer_id` | `customers.ts:66` + `orders.ts:297-324` | Cadastrar cliente em `/revenda/clientes` e comprar |
| A-29 | P2 | Workflow / bug | J5 | Solicitação de limite continua pendente mesmo depois de o admin aprovar o revendedor e configurar o limite pedido | `customers.ts:201-230` + `admin-ops.ts:448-478` | Solicitar R$ 500 e configurar R$ 500 no admin |
| A-30 | P2 | Conteúdo / ausência | J5 | Biblioteca comercial do revendedor está vazia; não há catálogo, mockup ou arte para download | `revenda/materiais/page.tsx:23-33` + `store.marketing_assets = 0` | Abrir `/revenda/materiais` |

---

## Linha de base (J0) — confirmada por consulta ao banco em 19/08

| | Loja (`store`) | CRM (`public`) |
|---|---|---|
| Produtos | 32 (32 ativos) | 2 |
| Imagens de produto | **0** | — |
| Categorias ativas | 27 | — |
| Clientes | 5 | 6 |
| Perfis de usuário | **1** | — |
| Pedidos | **0** | 2 |
| Orçamentos | **0** | 3 |
| Chamados / Ordens de produção | **0 / 0** | — |

Idêntica à linha de base de 16/08 — nada mudou em 3 dias, consistente com o bloqueio de
numeração de documentos herdado do relatório anterior. `store.profiles` com 1 linha para 5 `store.customers` é
uma divergência a investigar na J2 (cadastro pode não estar criando perfil para todo mundo).

**Testes automatizados:** Flow Printi — Vitest 21 arquivos, **200/200 passando** (166 em 16/08;
34 testes novos, incluindo `services/email/__tests__/resend.test.ts` e `templates.test.ts` —
há integração de e-mail transacional no CRM que o relatório anterior não tinha mapeado).
`npx tsc --noEmit`: Nexus-Printi limpo; Flow Printi com o mesmo erro de 16/08 (`data_mode` não
existe; achado herdado). Nexus-Printi lint: 0 erros, 35 avisos (igual a 16/08). **Nexus-Printi continua
sem nenhum runner de teste.**

---

## Achados de ambiente (J0) — não são bugs de jornada, mas condicionam toda a auditoria

| ID | Grav. | Tipo | O que acontece | Onde |
|---|---|---|---|---|
| A-01 | P2 | Risco | Histórico de migração não reconstrói o banco do zero | `20260601000000_initial_schema.sql` |
| A-02 | P1 | Bug | Cadastro público do CRM (`/signup`) cria conta órfã, sem empresa nem perfil | `signup.tsx` + trigger ausente |

### A-01 — O histórico de migração mente sobre como o banco nasceu *(P2, provado)*

`npx supabase db push`/replay do zero (`supabase start` com as migrações do repositório) falha
na terceira migração:

```
ERROR: relation "companies" already exists (SQLSTATE 42P07)
```

Porque `20260509020821_a3c76224...sql` já cria `public.companies`/`public.profiles`, e
`20260601000000_initial_schema.sql` ("Etapa 4: Schema Inicial do PrintFlow CRM V1") tenta criar
as duas de novo, com **um formato diferente e incompatível** (a segunda usa `id = auth.users.id`
direto e uma coluna `role`; a primeira usa `id` próprio + `user_id` + sem `role`). Comparando
com um dump real de produção (`pg_dump --schema-only`, leitura, nada alterado), confirmei que a
forma que está em produção é a da **primeira** migração — a segunda nunca rodou como está
escrita; foi provavelmente marcada como aplicada (`supabase migration repair`) sem executar,
num momento em que o schema já tinha divergido (provável herança do Lovable, dado o diretório
`.lovable/` no repositório).

**Impacto real:** hoje, nenhum — produção está de pé. O risco aparece no dia em que for preciso
reconstruir o banco (desastre, novo ambiente, staging real): `supabase db push`/replay do zero
**não reproduz o banco atual**, e falha ou produz um schema errado. Foi por isso que a J0 desta
auditoria teve que ser montada a partir de um dump de produção, e não das migrações — o próprio
processo de preparar este relatório é a reprodução do achado.

**Reprodução:**
```
cd "Flow Printi"
npx supabase start   # com as migrações do repositório, do zero
```

### A-02 — Cadastro público do CRM cria uma conta que não funciona *(P1, provado)*

`src/routes/signup.tsx:31-38` chama `supabase.auth.signUp` com `data: { full_name, company_name }`
e depende de um trigger `on_auth_user_created` (`public.handle_new_user`, definido em
`20260509020821_a3c76224...sql:42-59`) para criar `public.companies` + `public.profiles` a
partir desses metadados. **Esse trigger não existe em produção** — confirmado consultando
`pg_trigger` no espelho local, que foi construído a partir do dump real de produção.

O app não percebe: `signup.tsx` só olha o `error` do `signUp` (que não falha — a conta em
`auth.users` é criada normalmente), mostra "Conta criada! Bem-vindo ao PrintFlow." e navega para
`/dashboard`. Lá, `useAuth().loadProfile()` (`use-auth.tsx:42-65`) busca
`public.profiles` por `user_id` e não acha nada — `profileError` fica nulo (zero linhas não é
erro), `profile` fica `null` para sempre, silenciosamente. Toda tela que dependa de
`company_id`/RLS por empresa fica vazia ou quebrada, sem nenhuma mensagem explicando o motivo.

**Reprodução** (feita no espelho local; o mesmo trigger ausente em produção reproduz igual):
```sql
-- confirmação de que o trigger não existe em produção (via dump real, leitura):
select tgname from pg_trigger where tgname = 'on_auth_user_created';
-- 0 linhas
```
1. Acesse `/signup`, preencha nome, "Nome da gráfica", e-mail e senha, envie.
2. Toast de sucesso aparece, navega para `/dashboard`.
3. `public.companies` e `public.profiles` continuam sem a linha correspondente — confirmado por
   consulta direta após o signup.

**Achado colateral, não gravado como item separado:** este caminho não afeta a operação diária
de hoje porque o dono (P1) já tem conta funcionando por fora do fluxo público. Mas é a única
porta de entrada do sistema para "uma nova gráfica se cadastrar" — se esse for um uso pretendido
do Flow Printi (multi-tenant), está completamente quebrado.

---

## Ambiente e elenco (J0)

**Decisão de ambiente** (seção 2 do prompt): a preferência por branch do Supabase e stack local
foi seguida — branch está indisponível no plano atual (upgrade necessário), e o stack local via
Docker foi viabilizado depois de reparar o WSL2 (estava quebrado, `REGDB_E_CLASSNOTREG`).
**Nenhum dado de teste toca produção.** O espelho local roda a partir de um dump real do schema
de produção (nenhuma migração pendente de 20260816 aplicada nele) mais os dois apps apontando
para ele via `.env.local`/`.env.development.local` (arquivos locais, git-ignorados, produção
intocada).

**Elenco criado** (todos no espelho local, senha única `Auditoria!2026aA`):

| # | Pessoa | Conta criada | Observação |
|---|---|---|---|
| P1 | Jonathas, dono | `p1.dono@teste.nexusprinti.local` — `store.role=admin` + empresa/perfil no CRM (criados manualmente, ver A-02) | |
| P2 | Atendente de balcão | `p2.atendente@teste.nexusprinti.local` — `vendedor` | |
| P3 | Vendedor externo | `p3.vendedorexterno@teste.nexusprinti.local` — `vendedor` + `seller_profiles.commission_pct=5` | |
| P4 | Designer / pré-impressão | — | **papel não existe** — confirmado, ver seção 3.2 do prompt |
| P5 | Operador de máquina | — | **papel não existe** |
| P6 | Financeiro | — | **papel não existe** |
| P7 | Estoquista | — | **papel não existe** |
| P8 | Revendedor | `p8.revendedor@teste.nexusprinti.local` — `revendedor` | |
| P9 | Cliente online | `p9.clienteonline@teste.nexusprinti.local` — `cliente` | |
| P10 | Cliente de balcão | — | **sem conta, por natureza** — é o próprio ponto da J4 |
| P11 | Cliente de marketplace | — | **sem conta, por natureza** — é o próprio ponto da J6 |

---

## J1 — O catálogo chega na vitrine? *(P1, concluída em 20/08)*

**Resultado da jornada: falhou.** O produto nasce completo no CRM, mas não existe publicação
CRM → loja. O contorno documentado pelo próprio Flow Printi — cadastrar novamente no painel da
loja — também está bloqueado por um bug no formulário de produto.

### Caminho percorrido

1. Com P1, login em `http://localhost:8080/login` e abertura de **Produtos & Serviços → Novo
   Produto**.
2. Cadastro de `Cartão de visita 4x4`, SKU `QA-J1-CV-4X4-300G`, categoria `Offset`, status
   `Ativo`, imagem principal, prazo `3 dias úteis + frete` e cinco faixas: 100/250/500/1000/5000.
   O campo de status de marketplace também foi colocado em `Publicado`, porque é o único estado
   com esse nome no editor.
3. O CRM mostrou o toast **“Produto criado!”** e passou a listar o item. Consulta ao banco
   confirmou uma linha em `public.products`, com imagem, prazo e as cinco faixas em
   `quantity_prices`.
4. Imediatamente depois, `store.products` continuou com 0 linhas e a view
   `public.site_products` continuou com 0. A tela **Catálogo do site** do próprio CRM mostrou
   **“0 de 0 / Nenhum produto publicado na loja”**; a loja em `/produtos` também não exibiu o
   cartão cadastrado.
5. Para continuar a inspeção da vitrine, foi tentado o contorno indicado pela tela — cadastro
   no painel da loja. Foi criada a categoria `Cartões de visita`, mas o formulário de produto
   perdeu os campos ao trocar de aba e recusou o envio (A-04).
6. Somente para não encerrar a jornada no bloqueio, foram inseridos diretamente no **espelho
   local** um produto equivalente com imagem e cinco faixas, um produto sem imagem e uma
   categoria ativa sem produtos. Nenhum desses registros existe em produção.

### A-03 — O botão “publicar” do CRM não publica na loja *(P2, ausência, provado)*

O editor do CRM grava exclusivamente em `public.products` (`product-editor.tsx:441-485`). A
vitrine, porém, lê `store.products`; até a tela **Catálogo do site** do CRM lê a view
`public.site_products` (`produtos-site.tsx:68-70`), cuja definição seleciona de
`store.products` (`20260801000007_site_products_view.sql:19-50`). Não existe trigger de
produto entre os schemas: a consulta a `information_schema.triggers` retornou somente
`store.products_updated_at`, que atualiza `updated_at` dentro da própria tabela.

**Evidência de banco imediatamente após o sucesso no CRM:**

```text
public.products       1
store.products        0
public.site_products  0
```

O registro do CRM continha `status=Ativo`, `category=Offset`, imagem, prazo e as cinco faixas;
portanto, não foi um cadastro parcial nem um filtro de publicação. O status `Publicado` fica em
`editor_meta.marketplace.status` e não dispara nenhuma integração com a Nexus Printi.

**Impacto:** cada item precisa ser modelado duas vezes, em formatos diferentes (categoria texto
e faixas JSON no CRM; categoria por FK e faixas em tabela na loja). Hoje não há uma única fonte
de verdade para preço, prazo, imagem ou categoria. A operação pode improvisar com dupla
digitação — por isso P2 —, mas inevitavelmente cria divergência de catálogo.

**Reprodução:**

1. Entre no Flow Printi como P1 e abra `/produtos`.
2. Cadastre um produto ativo com SKU único, imagem, preço, prazo e faixas; salve.
3. Confirme o toast “Produto criado!” e a linha na grade do CRM.
4. Abra `/produtos-site` no CRM e `/produtos` na Nexus Printi.
5. Consulte `public.products`, `store.products` e `public.site_products` pelo SKU; o item existe
   somente na primeira.

**Provas visuais:** [produto criado no CRM](evidencias/j1/01-produto-crm-criado.png),
[catálogo do site vazio](evidencias/j1/02-catalogo-site-vazio.png) e
[vitrine sem o produto do CRM](evidencias/j1/03-vitrine-sem-produto-crm.png).

### A-04 — Formulário de produto da loja não consegue salvar todas as abas *(P2, bug, provado)*

O `<form>` envolve cinco `TabsContent` (`product-form.tsx:72-449`), mas os campos usam
`defaultValue` e não há estado consolidado. Na troca de aba, o painel anterior é desmontado e
seus inputs deixam o DOM; o servidor recebe `Object.fromEntries(formData)` (`admin.ts:211`),
isto é, somente os campos da aba que estava visível no clique.

Na execução real, Básico e Preços foram preenchidos; em **Publicação**, o produto foi marcado
como publicado e **Criar produto** foi acionado. A interface respondeu **“Confira os campos
destacados.”**. Ao voltar para Básico, os valores tinham desaparecido e os dois obrigatórios
mostravam:

```text
Nome do produto*: Invalid input: expected string, received undefined
Código interno (SKU)*: Invalid input: expected string, received undefined
```

O servidor registrou `POST /admin/produtos/novo 200` e a consulta por
`QA-J1-STORE-CV-4X4` retornou 0 linhas. Salvar a partir de Básico apenas inverte o problema:
`price_unit` e `base_price`, obrigatórios em `productSchema` (`admin.ts:147-193`), deixam de
existir no `FormData`.

**Impacto:** sem SQL direto ou outra ferramenta externa, o administrador não consegue criar um
produto vendável novo nem persistir uma edição completa. O catálogo existente ainda pode ser
vendido, mas ampliar ou corrigir a oferta obriga trabalho fora do sistema; pelo critério desta
auditoria, P2.

**Reprodução:**

1. Entre como administrador e abra `/admin/produtos/novo`.
2. Preencha nome, SKU e categoria na aba Básico.
3. Preencha preço e prazo na aba Preços e prazo.
4. Vá a Publicação, mantenha “Publicado na loja” ativo e clique em **Criar produto**.
5. Volte a Básico: os campos estão vazios e o servidor os acusa como `undefined`; nenhuma linha
   é criada em `store.products`.

### Resultado da vitrine após o contorno local

Com o registro equivalente inserido diretamente no schema `store`, a vitrine funcionou:

- a imagem carregou (`complete=true`, `naturalWidth=800`), categoria e prazo de 3 dias apareceram;
- as cinco faixas foram exibidas exatamente como 100–249 (R$ 0,22), 250–499 (R$ 0,18),
  500–999 (R$ 0,15), 1.000–4.999 (R$ 0,13) e 5.000+ (R$ 0,10); para 100 unidades, total e
  unitário fecharam em R$ 22,00 e R$ 0,22;
- o produto sem imagem não quebrou cartão nem detalhe: a loja mostrou o fallback com as iniciais
  `QP` e não houve erro de página;
- a categoria ativa sem produtos apareceu no menu, filtros e rodapé, mas a rota não ficou em
  branco: mostrou “Ainda não há produtos nesta categoria” e CTA de orçamento. É um comportamento
  observável de publicação, não um achado separado.

**Provas visuais:** [vitrine com os registros do contorno](evidencias/j1/04-vitrine-com-contorno-local.png),
[categoria vazia](evidencias/j1/05-categoria-vazia-no-menu.png) e
[produto com as cinco faixas](evidencias/j1/06-produto-local-faixas.png).

**Fechamento da J1:** a camada pública da loja renderiza corretamente imagem, fallback sem
imagem, categoria, prazo e faixas quando os dados existem em `store.*`. O defeito está antes da
vitrine: o CRM não escreve nesse catálogo e o formulário próprio da loja não consegue criar o
registro.

---

## J2 — A compra online completa *(P9, concluída em 20/08)*

**Resultado da jornada: falhou em três pontos críticos.** Um cliente novo não termina o
cadastro (A-05); depois do contorno local, o checkout não cria o pedido (A-06); depois do
segundo contorno, o envio de arte encontra o bucket inexistente (A-07). O painel administrativo
ainda não consegue confirmar o pagamento nem avançar a operação (A-08). Os trechos posteriores
da jornada foram executados somente com registros e mudanças de estado feitos diretamente no
espelho local, sempre identificados abaixo.

### Caminho percorrido

1. Em `/cadastro`, P9 preencheu nome, CPF válido, telefone, e-mail novo, senha e aceite. O Auth
   criou e confirmou imediatamente `p9.j2.clienteonline@teste.nexusprinti.local`, mas a
   navegação terminou em `ERR_TOO_MANY_REDIRECTS` entre `/painel` e `/entrar`. O banco tinha a
   linha em `auth.users` e zero linhas correspondentes em `store.profiles` e `store.customers`.
2. Para continuar, perfil `cliente` e cliente comercial foram inseridos diretamente no espelho
   local. Com a mesma sessão, `/painel` abriu normalmente.
3. Na loja, a busca literal **“cartão de visita”** encontrou somente o produto correto. Foram
   escolhidas 1.000 unidades e **Enviar depois da compra**. O configurador mostrou R$ 0,13 por
   peça, total R$ 130,00 e produção em 3 dias úteis.
4. O item foi adicionado ao carrinho. A sessão do navegador foi fechada; em outro navegador,
   após novo login, o carrinho reapareceu com o mesmo item, quantidade, fluxo de arte e preço.
5. Os cupons de ataque foram recusados com mensagens específicas: inexistente — “Cupom não
   encontrado”; expirado — “Este cupom expirou”; perfil `revendedor` — “não se aplica ao seu
   perfil”; limite global esgotado — “atingiu o limite de uso”. `QA-J2-10OFF` aplicou 10%, ou
   R$ 13,00. Depois do uso registrado, a tentativa seguinte retornou “Você já utilizou este
   cupom o número máximo de vezes”.
6. O CEP `01310-100` encontrou `QA-J2 Entrega São Paulo`, R$ 15,00 e 2 dias úteis. Carrinho e
   checkout fecharam em subtotal R$ 130,00, desconto R$ 13,00, frete R$ 15,00 e total R$ 132,00.
7. No checkout, os dados pessoais vieram preenchidos; endereço e Pix foram selecionados. Ao
   confirmar, a tela permaneceu no checkout com **“Não foi possível criar o pedido. Tente
   novamente em instantes.”**. O banco continuou com zero pedidos de P9 e o carrinho intacto.
8. A reprodução direta do mesmo `INSERT`, sem `number`, retornou `SQLSTATE 23502: null value in
   column "number" of relation "orders" violates not-null constraint`. Para seguir, foi criada
   por transação local a ordem `QA-J2-0001`, com item, pagamento Pix pendente, uso do cupom,
   conta a receber e conversão do carrinho. Total e composição foram preservados.
9. O trigger `tr_sync_order_to_crm` publicou imediatamente o mesmo UUID em `public.orders`: P1
   viu R$ 132,00 no painel administrativo da loja e no Flow Printi, com descrição
   `1000x Cartão de Visita...`.
10. P9 tentou enviar o PNG pelo detalhe do pedido. A linha do arquivo mostrou `Bucket not found`,
    nenhuma linha apareceu em `store.art_files`/`storage.objects`, mas a interface exibiu o toast
    **“Arquivos enviados!”**. A API de Storage de produção, consultada em leitura, confirmou que
    só existe o bucket `imported-products`, não `artes`.
11. Somente para continuar, o bucket `artes` e policies de leitura/inserção na pasta do próprio
    usuário foram criados no espelho local. A repetição gravou o PNG de 290,8 KB, versão 1, em
    `storage.objects` e `store.art_files`, com estado `em_analise`.
12. P1 abriu `QA-J2-0001` no admin e acionou **Confirmar pagamento manualmente**. A requisição
    retornou HTTP 500; o botão ficou para sempre em “Confirmando...”, sem alterar pedido,
    pagamento, financeiro ou CRM. O pagamento e os estados `em_producao`/`entregue` foram então
    simulados diretamente no banco local para completar os checkpoints de cliente.
13. O painel de P9 refletiu `Em produção`, `Pago`, arte `Aprovada`, valores e endereço. Após a
    simulação de entrega, a tela **Avaliações** liberou o item; P9 enviou nota 5 para o produto,
    4 para o atendimento e o registro apareceu como **Em moderação**.
14. **Repetir pedido** recriou no carrinho 1.000 unidades a R$ 0,13 com preços atualizados. Não
    copiou o desconto nem o frete — comportamento correto — e o cupom já usado foi recusado.

### Checkpoints da J2

| Checkpoint | Resultado | Evidência |
|---|---|---|
| Confirmação de e-mail | **Não executado neste ambiente** | Auth local auto-confirmou no mesmo instante; Mailpit ficou com 0 mensagens |
| Busca e configuração | Passou | 1.000 un., fluxo `criar_depois`, R$ 0,13/un. e R$ 130,00 |
| Preço vitrine → carrinho → pedido → CRM | Passou após contorno | R$ 130,00 de item em todas as camadas; total final R$ 132,00 |
| Carrinho após fechar o navegador | Passou | novo navegador/login recuperou a linha persistida em `store.carts` |
| Cupons inválido, expirado, outro perfil, esgotado e já usado | Passou | todos recusados com motivo específico; válido aplicou R$ 13,00 |
| Frete por CEP | Passou | `01310-100`: R$ 15,00, 2 dias úteis |
| Finalização por Pix | **Falhou — A-06** | erro genérico na tela; `orders.number` violou `not null` |
| Prazo produção + frete | **Falhou — A-11** | banco `2026-08-27`; loja e CRM mostraram `26/08/2026` |
| Envio da arte | **Falhou — A-07** | `Bucket not found` e falso toast de sucesso |
| Pedido para admin/CRM no mesmo instante | Passou após contorno | mesma ordem visível nos dois sistemas logo após a transação local |
| Notificação e e-mail | **Falhou — A-12** | 0 notificações e 0 e-mails; nenhum envio no caminho de pedido/arte |
| Acompanhamento, avaliação e repetição | Passou após contornos | produção visível, avaliação em moderação e item recriado no carrinho |

**Provas visuais principais:** [loop após cadastro](evidencias/j2/01-cadastro-loop-redirecionamento.png),
[produto com 1.000 unidades](evidencias/j2/02-produto-1000-arte-depois.png),
[carrinho recuperado](evidencias/j2/03-carrinho-persistente-reaberto.png),
[cupom válido](evidencias/j2/04-cupom-valido-10off.png),
[total com frete](evidencias/j2/05-carrinho-cupom-frete-total.png),
[checkout antes da confirmação](evidencias/j2/06-checkout-pix-pre-confirmacao.png),
[erro do checkout](evidencias/j2/07-checkout-erro-criar-pedido.png),
[pedido do contorno](evidencias/j2/08-pedido-confirmado-contorno-local.png),
[falha de bucket](evidencias/j2/09-arte-enviada.png),
[arte após contorno](evidencias/j2/10-arte-enviada-apos-contorno.png),
[notificações vazias](evidencias/j2/11-notificacoes-vazias.png),
[pedido no admin](evidencias/j2/12-admin-pedido-imediato.png),
[pedido no CRM](evidencias/j2/13-crm-pedido-sincronizado.png),
[acompanhamento](evidencias/j2/14-cliente-acompanha-producao.png),
[avaliação](evidencias/j2/15-avaliacao-enviada.png) e
[repetição](evidencias/j2/16-repetir-pedido-carrinho.png).

### A-05 — Cadastro da loja cria conta órfã e loop infinito *(P0, bug, provado)*

`signUpAction` (`auth.ts:57-105`) cria o usuário no Supabase e redireciona a sessão confirmada
para `/painel`. A loja resolve papel e permissões exclusivamente em `store.profiles`. No banco
atual não existe trigger não interno em `auth.users`; por isso, depois do cadastro, havia:

```text
auth.users       1  (e-mail confirmado, role=cliente nos metadados)
store.profiles   0
store.customers  0
```

O proxy (`proxy.ts:63-70`) encontra uma sessão, não acha perfil, assume `cliente` e manda
`/entrar` ou `/cadastro` para `/painel`. `requireAuth` (`auth.ts:38-49`) não acha o perfil e
manda `/painel` de volta para `/entrar`. Foram registrados dezenas de `GET /painel 307` até o
Chrome encerrar com `ERR_TOO_MANY_REDIRECTS`.

A correção já está escrita em
`20260801000004_store_auth_profiles.sql:18-84` (`store.handle_new_user` +
`on_auth_user_created_store`), mas não está aplicada no banco auditado. Isso confirma a
divergência levantada na J0: uma nova conta online não consegue comprar sem intervenção SQL.

**Reprodução:**

1. Com e-mail ainda inexistente, complete `/cadastro` como cliente.
2. Observe a criação da linha em `auth.users` e o redirecionamento para `/painel`.
3. O navegador termina em `ERR_TOO_MANY_REDIRECTS`.
4. Consulte `store.profiles` e `store.customers` pelo UUID do Auth: ambas retornam zero linhas.

### A-06 — Checkout não consegue atribuir número ao pedido *(P0, bug, provado)*

`createOrderAction` insere o pedido em `orders.ts:318-353`, não envia `number` e já tenta
devolvê-lo em `.select("id, number")`. No banco, `store.orders.number` é `text not null unique`,
sem default, e os únicos triggers da tabela são `orders_updated_at` e
`tr_sync_order_to_crm`. A sequência `store.order_number_seq` existe, mas ninguém a usa.

Na tela, o erro de banco é descartado em `orders.ts:357-358` e vira apenas “Não foi possível
criar o pedido”. A reprodução em uma transação revertida expôs a causa exata:

```text
ERROR: null value in column "number" of relation "orders" violates not-null constraint
```

Nenhum pedido, item, pagamento, uso de cupom ou lançamento financeiro nasceu, e o carrinho
permaneceu intacto. É P0: nenhum checkout da loja pode gerar venda no schema atual.

**Reprodução:**

1. Coloque um produto no carrinho, escolha entrega e Pix.
2. Complete o endereço e clique em **Confirmar pedido**.
3. A tela mostra o erro genérico e continua em `/checkout`.
4. Consulte `store.orders` pelo perfil: zero novas linhas; consulte o carrinho: item ainda lá.

### A-07 — Armazenamento de arte não existe e o erro vira sucesso *(P0, bug, provado)*

O código usa `STORAGE_BUCKETS.artes = "artes"` e há uma migração própria em
`Nexus-Printi/supabase/migrations/0004_storage.sql:10-57`, mas ela não faz parte do histórico
aplicado do Flow Printi. O espelho local tinha zero buckets; a API de Storage de **produção**,
consultada sem escrita, listou apenas `imported-products`.

Na execução, o Storage respondeu `Bucket not found`; `store.art_files` e `storage.objects`
continuaram vazias. Mesmo assim, `art-uploader.tsx:130` consulta o valor antigo de `tasks`
imediatamente após os `setTasks` assíncronos e conclui que não houve falha, mostrando o toast
“Arquivos enviados!”. Sem a arte, o pedido não pode ser conferido nem produzido; a mensagem
de sucesso ainda esconde o bloqueio operacional.

**Reprodução:**

1. Abra um pedido do próprio cliente em **Arte e aprovação**.
2. Selecione um PNG válido e clique em **Enviar 1 arquivo**.
3. A linha exibe `Bucket not found`, enquanto o toast afirma “Arquivos enviados!”.
4. Confirme zero linhas em `store.art_files` e ausência do objeto no bucket.

### A-08 — Ações administrativas do pedido retornam HTTP 500 *(P0, bug, provado)*

`production.ts` começa com `"use server"`, mas termina em `production.ts:268` exportando o
objeto `PRODUCTION_STAGES`. Next.js só aceita funções assíncronas como exports de um módulo de
Server Actions. O detalhe administrativo importa `generateProductionOrdersAction`; o loader
da página inclui esse módulo e derruba também ações vindas de outros arquivos.

Ao clicar em **Confirmar pagamento manualmente**, o servidor respondeu HTTP 500 e registrou:

```text
Error: A "use server" file can only export async functions, found object.
POST /admin/pedidos/4df895c9-... 500
```

O botão ficou em “Confirmando...”; pedido, pagamento, financeiro, histórico e CRM não mudaram.
Na prática, confirmação de pagamento, mudança de status, geração de OP e demais ações desse
detalhe não são utilizáveis — bloqueio P0 para receber e produzir.

**Reprodução:**

1. Como P1, abra `/admin/pedidos/[id]`.
2. Clique em **Confirmar pagamento manualmente** (ou tente outra ação do detalhe).
3. Observe HTTP 500, botão preso e nenhuma alteração no banco.

Prova: [ação administrativa presa](evidencias/j2/25-admin-acao-http500.png).

### A-09 — Executável renomeado para `.pdf` é aceito como arte *(P1, risco, provado)*

A validação cliente (`art-uploader.tsx:44-52`) e servidor (`art.ts:36-64`) olha somente a
extensão e o tamanho. Não há inspeção de assinatura, antivírus, quarentena ou validação real do
MIME. No ataque, `where.exe` (primeiros bytes ASCII `MZ`) foi copiado como `qa-j2-fake.pdf`.
A loja o enviou, registrou como versão 2 e persistiu:

```text
file_name=qa-j2-fake.pdf
file_size=65536
mime_type=application/pdf
extension=pdf
status=em_analise
```

O arquivo fica disponível para a equipe abrir. Isso transforma a caixa de arte em um vetor de
malware e, pelo critério de segurança/perda de dado da auditoria, é P1.

**Reprodução:**

1. Copie qualquer PE válido para um nome terminado em `.pdf`.
2. Envie-o como arte de um pedido próprio.
3. A interface mostra **Enviado** e o banco o registra como `application/pdf`.

Prova: [executável aceito como PDF](evidencias/j2/21-exe-renomeado-pdf-aceito.png).

### A-10 — O cliente não consegue encerrar a sessão pelo menu *(P1, bug, provado)*

No painel, `account-menu.tsx:117-123` coloca um `<form action={signOutAction}>` dentro de
`DropdownMenuItem asChild`. Clicar tanto no item quanto no botão interno apenas fecha o menu.
Em duas tentativas, não houve `POST`, `signOutAction` não apareceu no log, a URL continuou em
`/painel` e uma nova abertura da rota protegida exibiu os dados do cliente normalmente.

Em computador compartilhado, o usuário acredita ter saído e deixa pedidos, endereço e arquivos
acessíveis; por isso P1. O checkpoint “voltar no histórico depois do logout” não pôde ser
executado: o logout do caminho normal não acontece.

**Reprodução:**

1. Entre como cliente e abra **Menu da conta**.
2. Clique em **Sair da conta**.
3. Abra novamente `/painel`: a sessão e os dados continuam ativos; não existe requisição de
   logout no log do servidor.

### A-11 — Datas de entrega aparecem um dia antes *(P2, bug, provado)*

O pedido foi gravado com `store.orders.estimated_delivery = 2026-08-27`; o trigger copiou
`public.orders.deadline = 2026-08-27`. Loja, admin e CRM exibiram `26/08/2026`.

Na Nexus, `format.ts:61-69` transforma a string SQL `YYYY-MM-DD` em `new Date(value)` — meia-noite
UTC — e depois formata em `America/Sao_Paulo`, recuando para a noite anterior. O Flow repete o
problema em `_app/pedidos.tsx:200` com `new Date(p.deadline).toLocaleDateString('pt-BR')` no
navegador brasileiro. O preço ficou consistente, mas o prazo prometido é um dia mais curto que
o prazo calculado e persistido.

**Reprodução:**

1. Grave um pedido com `estimated_delivery='2026-08-27'` e sincronize com o CRM.
2. Abra o comprovante, o painel/admin da loja e a lista de pedidos do Flow.
3. Todas as telas mostram `26/08/2026`; a consulta SQL continua em `2026-08-27`.

### A-12 — Não há aviso de pedido, pagamento ou arte *(P2, ausência, provado)*

Após pedido, upload de arte e mudanças simuladas de pagamento/status, P9 tinha zero linhas em
`store.notifications`; `/painel/notificacoes` dizia **“Nenhuma notificação”**. Mailpit também
ficou com zero mensagens. `RESEND_API_KEY` não existe no ambiente local nem no ambiente
configurado da loja, e a busca em `Nexus-Printi/src` encontra Resend somente no texto da tela de
integrações, não em uma rotina de envio.

Além da execução, `createOrderAction` (`orders.ts:318-498`), `confirmPaymentAction`
(`orders.ts:543-577`) e `registerArtFileAction` (`art.ts:73-148`) não inserem notificação nem
chamam provedor de e-mail. A única notificação próxima desse fluxo é criada quando um admin
cola manualmente um link de pagamento (`orders.ts:778-785`). A interface promete “Você recebe
uma notificação a cada mudança de etapa”, mas isso não acontece no banco atual.

**Limitação explícita:** a confirmação inicial de e-mail não foi validada, porque o Auth local
auto-confirmou a conta. Esse passo não foi marcado como aprovado.

**Reprodução:**

1. Crie/avance um pedido e envie uma arte.
2. Abra `/painel/notificacoes` e consulte `store.notifications` pelo perfil.
3. Consulte Mailpit e os logs de envio: ambos permanecem vazios.

### A-13 — Quantidade milionária não tem limite operacional *(P2, risco, provado)*

Quantidade `0` e negativa foram corretamente normalizadas para o mínimo de 100. Porém,
`1.000.000` foi aceita pelo configurador, com botão de compra ativo e total de R$ 100.000,00 a
R$ 0,10/unidade. Não existe capacidade, estoque, limite por pedido ou aprovação para volume
excepcional. Mesmo com o checkout corrigido, uma venda inviável entra pelo mesmo caminho de
1.000 unidades e recebe o melhor preço da faixa aberta `5000+`.

**Reprodução:**

1. Abra o cartão de visita e digite `1000000` em **Quantidade**.
2. Saia do campo: a loja mantém o valor e calcula R$ 100.000,00.

### Ataques transversais executados depois da J2

**Permissões/RLS — passaram.** Foi criado um pedido QA mínimo pertencente a P1 apenas para o
ataque. P9 e P8 receberam 404 ao abrir pedidos alheios pela interface. Pela REST do Supabase,
com `Accept-Profile: store`, os resultados foram: P9 próprio = 1 linha; P9 alheio = 0; P8
pedido de P9 = 0; P2 em `finance_entries` = 0; anônimo em `orders` = 0. P2 também foi
redirecionado de `/admin/financeiro` para `/vendas`. Provas:
[P9 bloqueado](evidencias/j2/18-rls-p9-pedido-alheio.png),
[P2 bloqueado no financeiro](evidencias/j2/19-permissao-p2-financeiro.png) e
[P8 bloqueado](evidencias/j2/24-rls-p8-pedido-alheio.png).

**Concorrência — inconclusiva por bloqueios anteriores.** Dois checkouts com o último uso de
cupom e duas abas finalizando o mesmo carrinho não alcançam a etapa concorrente: ambos param em
A-06 antes de registrar pedido/uso. Dois admins confirmando pagamento param em A-08. Não existe
OP utilizável nem papel de operador para o quarto ataque. O risco conhecido continua no código:
`used_count` é lido e regravado em chamadas separadas (`orders.ts:425-431`) e a criação do
pedido é uma sequência de escritas sem transação (`orders.ts:318-483`), mas não foi rotulado
como “reproduzido” nesta execução.

**Dados sujos:**

- CPF `111.111.111-11` e CNPJ repetido inválido foram recusados antes de criar `auth.users`;
- CEP fora da faixa mostrou orientação para combinar o frete; um número de oito dígitos dentro
  da faixa recebe opção apenas pela regra numérica — não há consulta de existência do CEP;
- quantidades 0 e negativa voltaram a 100; 1.000.000 gerou A-13;
- arquivo de 200 MB foi recusado com “Arquivo maior que 100 MB”; prova:
  [limite de arte](evidencias/j2/20-arte-200mb-recusada.png);
- executável renomeado para `.pdf` gerou A-09;
- nome com emoji foi aceito e preservado em `auth.users.raw_user_meta_data`; depois caiu no mesmo
  loop de perfil ausente de A-05;
- a observação `'; drop table store.orders; --` foi persistida literalmente em `store.carts`;
  `store.orders` continuou existindo com duas linhas — sem injeção;
- segundo cadastro com o mesmo e-mail foi recusado com “Já existe uma conta com este e-mail” e
  manteve uma única linha no Auth.

**Ambiente:** o ambiente já está sem `RESEND_API_KEY`, portanto o resultado de e-mail é o de
A-12. Repetir sem service role não chega à diferença de financeiro/comissão porque A-06 ocorre
antes; esse ataque ficou bloqueado. Com o Postgres local parado no clique final, o checkout
ficou em “Registrando pedido...” e, cerca de 11 segundos depois, mostrou a página genérica
“Algo deu errado”; o banco foi reiniciado saudável e não houve pedido duplicado. Prova:
[Supabase indisponível](evidencias/j2/23-supabase-indisponivel-checkout.png).

**Sessão:** conta desativada durante a navegação foi imediatamente enviada para
`/conta-inativa` e voltou a funcionar após reativação; prova:
[conta desativada](evidencias/j2/22-conta-desativada-sessao-aberta.png). A troca de `cliente`
para `revendedor` foi percebida na mesma sessão e o acesso a `/entrar` redirecionou para
`/revenda`; `/painel` permaneceu acessível com layout de cliente e badge de revendedor, sem
vazamento de dados alheios. Dois navegadores simultâneos com a mesma conta funcionaram. Logout
e retorno pelo histórico ficaram bloqueados por A-10.

### Contornos e resíduos locais da J2

Todos os contornos abaixo existem somente no espelho local e foram necessários para atravessar
os P0 sem corrigir o produto:

- perfil/cliente comercial de `p9.j2.clienteonline@teste.nexusprinti.local`;
- cupons `QA-J2-*` e zona `QA-J2 Entrega São Paulo`;
- pedido `QA-J2-0001` (`4df895c9-8967-4bb1-a82b-ef257598e3fd`) e pedido mínimo
  `QA-J2-PERM-OUTRO` para RLS;
- bucket `artes` com duas policies QA locais; PNG válido e o objeto `qa-j2-fake.pdf` mantidos
  como evidência;
- avanços locais de pagamento/status até `entregue` para liberar acompanhamento e avaliação.

Os dois arquivos temporários do ataque (200 MB e cópia local do executável) foram removidos
de `%TEMP%` após o teste. Nenhuma escrita foi feita em produção.

### Fechamento parcial após J2

**O que impede a gráfica de operar amanhã:** cadastro de cliente novo (A-05), criação de pedido
(A-06), recebimento de arte (A-07) e ações administrativas do pedido (A-08).

**O que vai doer quando o volume subir:** arquivo sem inspeção (A-09), sessão que não encerra
(A-10), promessa de prazo um dia adiantada (A-11), cliente sem aviso (A-12), volume sem limite
(A-13), corrida de cupom e checkout não atômico ainda não executáveis por causa dos P0.

---

## J3 — Orçamento que vira venda *(P10 → P2 → P1, concluída em 22/08)*

**Resultado da jornada: falhou.** O orçamento público não nasce, o CRM não recebe o registro da
loja, o envio não gera link utilizável e a conversão manual da proposta aprovada não cria pedido.
Com contornos exclusivamente locais foi possível provar que os valores da proposta ficam
congelados corretamente e que o aceite gera histórico/notificação; também foi encontrado um
bypass que permite aprovar proposta vencida pelo RPC anônimo.

### Checkpoints da jornada

| Checkpoint | Resultado | Evidência |
|---|---|---|
| P10 solicita em `/orcamento`, sem conta | **Falhou** | erro genérico na tela, zero linhas no banco e REST `401/42501` por RLS |
| P2 recebe a solicitação | **Falhou** | registro equivalente sem `seller_id` não aparece para P2; não existe atribuição automática |
| Flow Printi recebe o orçamento/lead | **Falhou** | Nexus usa `store.quotes`; Flow continua lendo `public.quotes`, que ficou vazio |
| P2 cria/salva proposta nova | **Falhou** | `store.quotes.number` é `not null` e o insert omite `number` |
| P2 salva itens e 10% de desconto | **Passou com contorno** | em orçamento injetado com número, R$ 130,00 − R$ 13,00 = R$ 117,00 |
| P2 envia link público | **Falhou** | status vira `enviado`, mas `public_token` fica nulo; token injetado abre 404 porque os RPCs não existem |
| P10 abre e aprova pelo link | **Passou com contorno** | RPCs temporários permitiram exibir e aceitar sem login; histórico e notificação foram criados |
| Valores permanecem congelados | **Passou** | catálogo alterado de R$ 0,13 para R$ 0,99; proposta continuou em R$ 0,13/R$ 117,00 |
| Aceite vira pedido | **Falhou** | aceite só muda o orçamento para `aprovado`; conversão manual cai em A-06 e deixa zero pedidos |
| P1 acompanha o resultado | **Parcial** | vê proposta aprovada de R$ 117,00, mas 0 convertidos e nenhum pedido |
| Link expira | **Não** | conteúdo continua legível após `valid_until`; apenas os botões somem na UI |
| Terceiro enumera tokens | **Não reproduzido** | REST anônimo de `quotes` devolveu `[]`; token aleatório devolveu `null` |
| Terceiro com o link abre | **Sim, por desenho** | token é bearer link: qualquer pessoa com a URL vê a proposta, sem identidade do destinatário |

### Caminho percorrido

1. Em sessão anônima, P10 preencheu nome, empresa, e-mail, telefone, produto, 1.000 peças,
   prazo e especificação completa em `/orcamento`. A tela devolveu **“Não foi possível registrar
   sua solicitação”** e `store.quotes` continuou com zero linhas. Prova:
   [falha do envio público](evidencias/j3/02-envio-publico-falha.png).
2. A mesma carga enviada diretamente ao Data API como `anon`, com `Content-Profile: store`,
   respondeu `401` com PostgreSQL `42501`: `new row violates row-level security policy for table
   "quotes"`. A policy exige admin, `created_by = auth.uid()` ou `profile_id = auth.uid()`; os dois
   campos e `auth.uid()` são nulos para o visitante.
3. Para atravessar o primeiro P0, foi criada no espelho local a solicitação equivalente
   `QA-J3-0001`, com número manual e sem vendedor. O P2 viu **0 orçamentos** no Nexus; só passou a
   vê-la depois de uma atribuição SQL manual. Prova:
   [P2 não recebe a fila sem atribuição](evidencias/j3/03-p2-nao-recebe-solicitacao-sem-atribuicao.png).
4. Mesmo depois da atribuição, o Flow Printi continuou vazio. A consulta simultânea mostrou
   `store.quotes = 1 (J3 = 1)` e `public.quotes = 0 (J3 = 0)`. Prova:
   [CRM sem o orçamento da loja](evidencias/j3/04-flow-crm-sem-orcamento-da-loja.png).
5. No Nexus, P2 adicionou o produto do catálogo, quantidade 1.000, preço unitário R$ 0,13,
   desconto de 10%, frete a combinar, prazo de 5 dias úteis e validade de 15 dias. O resumo e o
   banco concordaram em subtotal R$ 130,00, desconto R$ 13,00 e total R$ 117,00. Prova:
   [proposta montada](evidencias/j3/05-p2-proposta-com-desconto.png).
6. **Salvar e marcar como enviado** alterou o status para `enviado`, mas deixou `public_token`
   nulo e a própria tela continuou dizendo que o link seria gerado. Prova:
   [enviado sem link](evidencias/j3/06-p2-enviado-sem-link-publico.png). Um token de 128 bits foi
   injetado somente para continuar; `/proposta/[token]` ainda respondeu 404 porque
   `store.get_public_quote` não existe. Prova: [token em 404](evidencias/j3/07-link-token-404-sem-rpc.png).
7. Foram recriados temporariamente no schema `store` os dois RPCs presentes na migração antiga do
   Nexus. A definição original de `get_public_quote` falhou com `0A000: UPDATE is not allowed in a
   non-volatile function`, pois foi declarada `STABLE` e tenta atualizar `viewed_at`. Alterar apenas
   a volatilidade no espelho liberou o restante do teste.
8. P10 abriu a proposta sem sessão e viu os valores esperados. Depois, a faixa de preço do produto
   foi mudada localmente de R$ 0,13 para R$ 0,99; a proposta continuou em R$ 0,13, subtotal
   R$ 130,00 e total R$ 117,00. A faixa foi restaurada imediatamente. Provas:
   [proposta pública](evidencias/j3/08-proposta-publica-valores-congelados.png) e
   [snapshot preservado após mudar o catálogo](evidencias/j3/09-proposta-mantem-preco-apos-catalogo-mudar.png).
9. P10 aceitou pelo link. `store.quotes.status` passou a `aprovado`, `responded_at` foi gravado,
   `quote_history` recebeu a observação do cliente e P2 recebeu uma notificação. Ainda havia zero
   pedidos: o aceite não converte automaticamente. Prova:
   [aceite público](evidencias/j3/10-cliente-aprova-proposta.png).
10. P2 clicou **Converter em pedido**. A tela devolveu **“Não foi possível gerar o pedido”** e a
    consulta confirmou `converted_order_id = null` e zero `store.orders`. A reprodução SQL da
    mesma inserção devolveu `23502: null value in column "number" of relation "orders"`, a mesma
    raiz de A-06. Prova: [conversão falha](evidencias/j3/11-conversao-em-pedido-falha.png).
11. P1 abriu o administrativo e viu uma proposta aprovada de R$ 117,00, **0 convertidos em
    pedido** e o mesmo botão de conversão ainda disponível. Prova:
    [visão do P1](evidencias/j3/12-p1-ve-aprovado-sem-pedido.png).

### A-14 — O visitante não tem permissão para pedir orçamento *(P0, provado)*

`requestQuoteAction` (`content.ts:87-110`) usa o client sujeito a RLS e insere a solicitação em
`store.quotes` com `profile_id = null` e `created_by = null` quando não há login — comportamento
coerente com a promessa do formulário. Porém, `orcamentos_cria`
(`20260801000002_store_rls.sql:564-570`) só aceita admin ou igualdade desses campos com
`auth.uid()`. Para `anon`, a expressão nunca é verdadeira.

O servidor engole o erro do banco e devolve a mesma mensagem genérica para qualquer causa, por
isso a UI não explica que a solicitação não foi recebida. Mesmo que a policy fosse ampliada, o
insert seguinte bateria em `number not null` (A-15). Este não é um problema de dado artificial:
a chamada REST anônima isolou exatamente a policy efetiva do banco.

### A-15 — O schema `store` perdeu a infraestrutura de orçamentos *(P0, provado)*

A migração unificada cria `store.quotes.number text not null unique` e `public_token text unique`
(`20260801000000_unify_store_schema.sql:736-766`), mas não porta o trigger antigo
`quotes_assign_number`, que gerava os dois valores (`0002_functions.sql:192-210`). No banco real
espelhado existe somente `quotes_updated_at`.

Isso produz três quebras independentes na mesma jornada:

- P2 não consegue criar orçamento novo: `saveQuoteAction` insere sem `number`; a tela mostrou
  **“Não foi possível criar o orçamento”**. Prova:
  [criação interna falha](evidencias/j3/15-p2-nao-cria-orcamento-sem-number.png);
- em registro contornado com número, `sendQuoteAction` só muda `status`, não cria token. A ação
  retorna sucesso sem URL e deixa o usuário acreditando que enviou;
- `store.get_public_quote` e `store.respond_public_quote` não existem. Mesmo com token injetado,
  o Data API devolve `PGRST202` e a página pública vira 404.

Há ainda uma armadilha para a correção: o RPC antigo `public.get_public_quote`
(`0002_functions.sql:588-650`) é `STABLE`, mas atualiza o orçamento para visualizado. Transplantado
literalmente para `store`, ele falha em runtime com `0A000`; precisa ser `VOLATILE` ou separar a
leitura da escrita.

### A-16 — Loja e CRM mantêm dois universos de orçamento *(P0, provado)*

O Nexus configura `db.schema = "store"` (`config.ts:14-18`). O Flow cria o client no schema
padrão e sua tela consulta `.from("quotes")` com colunas do modelo legado
(`_app/orcamentos.tsx:147-160`), portanto lê `public.quotes`. Não há trigger de quote entre os
schemas no banco atual.

O comentário de `requestQuoteAction` promete **“orçamento em rascunho + oportunidade no funil”**,
mas o corpo da função só insere em `quotes` e `quote_history`; não há insert em `opportunities`.
No contorno J3, a consulta confirmou zero oportunidades vinculadas. Resultado: o atendente só
consegue trabalhar no painel de vendas do Nexus e ainda depende de atribuição manual; a fila de
Orçamentos e o funil do Flow não recebem nada.

### A-17 — Validade é proteção apenas visual; RPC aceita proposta vencida *(P1, provado)*

Foi criada a cópia `QA-J3-EXP-0002` com `valid_until = 2026-08-21`. Em sessão anônima, o link
continuou expondo contato, itens, observações, preços e condições; a UI marcou a proposta como
expirada e escondeu os botões. Prova:
[link vencido ainda legível](evidencias/j3/13-link-expirado-ainda-expoe-proposta.png).

Em seguida, o mesmo visitante chamou diretamente `respond_public_quote` com o token e
`decision = aprovado`. O RPC respondeu HTTP 200 com `{"ok": true, "status": "aprovado"}` e
gravou `responded_at`/histórico, embora a validade já tivesse passado. Prova:
[proposta expirada aprovada pelo RPC](evidencias/j3/14-rpc-aprova-proposta-expirada.png).

A causa está em `0002_functions.sql:655-679`: a função rejeita apenas status `convertido` ou
`expirado`, mas nunca compara `valid_until` com a data atual. A página faz essa comparação em
`proposta/[token]/page.tsx:60-62`; como o navegador não é fronteira de segurança, a regra é
contornável. O token em si também não expira: após a validade, o conteúdo continua acessível.

### Ataques de token e integridade

**Enumeração:** passou. Um GET anônimo em `store.quotes?select=id,number,public_token` devolveu
`[]` por RLS, e um token aleatório de 32 caracteres devolveu `null`. Não foi encontrada listagem
anônima dos tokens. O valor gerado pelo desenho antigo tem 128 bits aleatórios e índice único.

**Posse do link:** qualquer navegador sem login abre a proposta correta. Isso é coerente com o
produto (“sem precisar criar conta”), mas deve ser tratado operacionalmente como link secreto:
não existe conferência de e-mail, telefone ou identidade do destinatário. O relatório não rotula
isso sozinho como vulnerabilidade; A-17 é a quebra objetiva de autorização temporal.

**Reuso:** depois do aceite, a UI não oferece nova decisão. O RPC, porém, também não restringe
status `aprovado`/`recusado`. Com o mesmo token vencido já aprovado, chamadas anônimas para
`recusado` e depois `aprovado` retornaram HTTP 200 e criaram mais duas linhas de histórico. Não
foi criado ID separado porque a correção de A-17 deve centralizar no banco todos os estados e a
validade permitidos para resposta.

**Integridade de valores:** passou. `quote_items` preserva `quantity`, `unit_price`, `total_price`
e `base_price`, e a página pública lê esse snapshot. A mudança temporária do catálogo não alterou
a proposta; a faixa original foi restaurada. Não foi possível validar o snapshot já dentro do
pedido porque A-06 impede a conversão.

### Contornos e resíduos locais da J3

Todos os contornos abaixo foram aplicados somente no espelho local; produção permaneceu
read-only:

- `QA-J3-0001`, número/token e atribuição a P2 injetados para atravessar A-14/A-15;
- `QA-J3-EXP-0002` para o ataque de validade;
- `store.get_public_quote` e `store.respond_public_quote` criados temporariamente a partir da
  migração antiga; `get_public_quote` teve apenas a volatilidade alterada para liberar o teste;
- preço da faixa 1.000–4.999 alterado de R$ 0,13 para R$ 0,99 e restaurado no mesmo passo.

Os dois RPCs temporários foram removidos no encerramento para o espelho voltar a representar o
estado encontrado. Os dados QA foram mantidos como evidência. Nenhuma correção de produto foi
feita.

### Fechamento parcial após J3

**O que impede orçamento de virar venda amanhã:** formulário anônimo bloqueado (A-14),
numeração/token/RPCs ausentes (A-15), CRM separado da loja (A-16) e criação de pedido ainda
bloqueada por A-06.

**O que funciona quando os bloqueios são contornados:** cálculo de item/desconto, snapshot de
preço, exibição pública, histórico do aceite e notificação do vendedor.

**Risco de segurança/regra:** proposta vencida continua legível e pode ser aprovada diretamente
no RPC (A-17). A validade exibida também repete o recuo de um dia de A-11: `2026-09-11` apareceu
como `10/09/2026`, e `2026-08-21` como `20/08/2026`.

---

## J4 — Balcão: a loja física *(P10 + P2, concluída em 22/08)*

**Resultado da jornada: falhou.** Não há fluxo de balcão/POS em nenhum dos dois sistemas. O
caminho mais próximo é **Novo pedido manual** no Flow, mas P2 não tem um papel operacional no
CRM e é barrado pela RLS. Depois de dois contornos estritamente locais, foi possível criar o
pedido `PED-000002`; ele permaneceu isolado em `public.orders` e só chegou a “pago/entregue” por
rótulos, sem PIX, caixa, recibo, ordem de produção, estoque ou registro da retirada.

### Checkpoints da jornada

| Checkpoint | Resultado | Evidência |
|---|---|---|
| P2 acessa o Flow como atendente | **Falhou** | login funciona, mas falta `public.profiles`; criar cliente retorna “Empresa não identificada” |
| P10 compra sem e-mail | **Parcial com contorno** | e-mail é opcional, porém cliente persistente é obrigatório |
| Produto “50 fotos 10x15” | **Falhou** | inexiste no catálogo; descrição, quantidade e R$ 75,00 foram digitados manualmente |
| Setor/máquina de fotografia | **Falhou** | não existe; P2 precisou escolher “Sublimação” |
| Pedido aparece no Nexus | **Falhou** | `public.orders = 1`, `store.orders` correspondente = 0; painel P2 lista 0 pedidos |
| Produção é criada | **Falhou** | cartão aparece só na visão simplificada; dashboard/PCP e `public.production_orders` continuam em 0 |
| PIX é registrado | **Falhou** | somente `payment_status = pago`; zero `store.payments` e zero lançamento financeiro |
| Baixa no caixa | **Falhou** | não existe caixa/sessão de caixa no Flow; financeiro do Nexus é restrito ao admin |
| Recibo/comprovante | **Falhou** | Flow não oferece emissão; comprovante do Nexus com o UUID devolve 404 |
| Baixa de estoque | **Falhou** | zero `store.stock_movements`; o pedido não tem item/SKU/insumo |
| Retirada | **Falhou** | “entregue” é só um status, sem operador, data/hora, assinatura ou histórico |

### O caminho que o atendente é obrigado a improvisar

1. P2 entrou no Flow e abriu **Pedidos → Novo pedido manual**. O botão **Criar Pedido** fica
   desabilitado enquanto nenhum cliente é escolhido; não há opção “consumidor balcão” ou venda
   anônima. Prova: [cliente obrigatório](evidencias/j4/05-pedido-manual-cliente-obrigatorio.png).
2. Em **Clientes → Novo cliente**, só o nome é obrigatório; portanto **não é necessário inventar
   um e-mail falso**. P10 foi cadastrado como `P10 Balcão J4`, com e-mail e WhatsApp vazios.
   Provas: [formulário sem e-mail obrigatório](evidencias/j4/06-cliente-sem-email-permitido.png)
   e [cliente criado](evidencias/j4/09-cliente-p10-sem-email-criado.png).
3. Antes disso, o caminho real de P2 bloqueou duas vezes: primeiro **“Empresa não identificada”**
   porque sua conta Auth não tinha perfil no Flow; depois, mesmo com perfil local, a policy
   owner-only respondeu `42501` para `clients`. Provas:
   [sem empresa](evidencias/j4/07-cliente-criado-sem-email.png) e
   [RLS owner-only](evidencias/j4/08-cliente-sem-email-criado-com-workaround.png).
4. Para continuar, foi criado temporariamente um perfil local de P2 e o `owner_id` da empresa
   foi trocado de P1 para P2. Só então a UI permitiu o cadastro e o pedido. Esse não é um fluxo
   utilizável numa loja: tornar o atendente dono é o único modelo de autorização disponível.
5. O pedido exigiu digitar livremente `50 fotos 10x15 — impressão imediata`, quantidade 50 e
   total R$ 75,00. O sistema não calculou preço, não associou SKU nem conferiu capacidade. Como
   as únicas opções são Offset, DTF Têxtil, DTF UV, Sublimação, Acabamento e Design, foi escolhida
   **Sublimação** apenas para atravessar o formulário. Prova:
   [pedido manual preenchido](evidencias/j4/10-pedido-manual-preenchido.png).
6. A escolha de prazo “Hoje” fechou o modal e descartou o formulário em duas tentativas
   automatizadas. O pedido foi criado com o default de sete dias e o prazo foi corrigido para
   `2026-08-22` diretamente no banco local para continuar o teste “na hora”. Ao voltar à lista,
   apareceu `21/08/2026`, repetindo o recuo de fuso de A-11. Prova:
   [pedido na lista](evidencias/j4/12-pedido-na-lista.png).
7. Ao criar, o Flow mostrou **“Pedido gerado com sucesso! Produção e Financeiro atualizados.”**
   Prova: [toast de sucesso](evidencias/j4/11-pedido-manual-criado.png). A mutação, porém, faz um
   único insert em `public.orders`; a consulta imediata encontrou zero OP, pagamento, lançamento
   financeiro e movimento de estoque.
8. Em Produção, o dashboard e o PCP mostraram **0 OPs**; apenas a aba **Visão de Pedidos**, que lê
   diretamente `public.orders`, exibiu o cartão. Provas:
   [dashboard zerado](evidencias/j4/13-producao-dashboard.png) e
   [cartão na visão simplificada](evidencias/j4/14-producao-visao-pedidos.png). Arrastar
   `PED-000002` para **Pronto** não alterou a tela nem o banco.
9. Em Financeiro, P2 viu R$ 75,00 pendentes e abriu um modal com um único campo: **Status de
   Pagamento**. Não há forma de pagamento, NSU/end-to-end do PIX, valor efetivamente recebido,
   comprovante, operador ou data. Provas: [pedido não pago](evidencias/j4/16-financeiro-pedido-nao-pago.png)
   e [modal sem método](evidencias/j4/17-financeiro-modal-sem-metodo.png).
10. Trocar o rótulo para **Pago** fez “Total recebido” subir de R$ 132,00 para R$ 207,00, sem
    criar qualquer registro financeiro. Prova:
    [pago sem PIX](evidencias/j4/19-financeiro-pago-sem-pix.png).
11. No Nexus, P2 continuou com **0 pedidos** em `/vendas/pedidos` e o UUID do pedido manual
    respondeu 404 na rota de comprovante. O financeiro administrativo também redirecionou P2
    para `/vendas`. Provas: [Nexus sem o pedido](evidencias/j4/21-nexus-p2-pedidos-sem-j4.png),
    [comprovante indisponível](evidencias/j4/22-comprovante-indisponivel.png) e
    [financeiro bloqueado](evidencias/j4/23-nexus-p2-financeiro-bloqueado.png).
12. Para terminar a simulação, os status **Pronto** e **Entregue** foram aplicados diretamente
    no banco local. A UI refletiu os rótulos, mas `updated_at` permaneceu igual ao instante da
    criação e `production_history`, `stock_movements`, pagamentos e financeiro continuaram em
    zero. Provas: [pronto por contorno](evidencias/j4/24-pedido-pronto-workaround.png) e
    [entregue sem retirada](evidencias/j4/25-entregue-sem-registro-retirada.png).

### A-18 — O Flow só autoriza o dono; atendente não é um papel operacional *(P0, provado)*

A conta P2 existe no Auth e entra no CRM, mas não havia linha em `public.profiles`. O cadastro de
cliente consulta `profiles.company_id` por `user_id` e falha explicitamente sem ele
(`_app/clientes.tsx:91-103`). Criar o perfil não resolveu: as policies efetivas de `clients` e
`orders` usam `user_owns_company(company_id)`, função que só retorna verdadeiro quando
`companies.owner_id = auth.uid()`.

Não existe tabela de membros, vínculo funcionário–empresa nem `role` em `public.profiles` no
schema real. Resultado: o único usuário do Flow capaz de operar os dados da gráfica é P1. Para
executar a J4 foi preciso fazer P2 virar temporariamente o **dono** da empresa — evidência direta
de que o modelo não suporta o atendente descrito pelo produto.

### A-19 — O pedido manual do CRM não é um pedido operacional *(P0, provado)*

`_app/pedidos.tsx:72-99` gera o número contando linhas e insere somente em `public.orders` os
campos de cabeçalho, descrição livre e dois status. A própria migração de sincronização registra
explicitamente que **“public.orders não escreve em store.orders”**
(`20260801000005_fix_sync_depth_guard.sql:90`).

Após `PED-000002`, a fotografia do banco foi: 1 cabeçalho em `public.orders`; 0 pedido
correspondente em `store.orders`; 0 item; 0 `public.production_orders`; 0 `store.payments`; 0
`store.finance_entries`; 0 `store.stock_movements`. Por isso Nexus, OP, recibo, estoque e as
automações do pedido nunca participam da venda.

### A-20 — “Pago” não registra um recebimento PIX nem uma baixa de caixa *(P1, provado)*

A tela Financeiro não lê uma tabela financeira: consulta novamente `public.orders`
(`_app/financeiro.tsx:30-50`). A mutação atualiza exclusivamente `payment_status`
(`:53-59`), e o modal oferece cinco rótulos (`:180-213`). Não existe campo nem linha para método,
valor pago, identificador PIX, comprovante, data de compensação ou usuário responsável.

Também não foi encontrada sessão/abertura/fechamento de caixa no Flow. O Nexus possui
`store.payments` e `store.finance_entries`, mas o pedido não chega ao schema `store` e P2 não
pode abrir `/admin/financeiro`. Portanto não há onde “dar baixa no caixa”: na prática, o
atendente marcaria Pago e precisaria reconciliar o PIX fora dos sistemas.

### A-21 — Não existe comprovante para a venda de balcão *(P1, provado)*

Flow Pedidos e Financeiro não oferecem ação de recibo/impressão. O Nexus tem comprovante apenas
para pedidos reais de `store.orders`; como `PED-000002` existe só em `public.orders`, acessar
`/painel/pedidos/0ca3942b-607d-44dd-a47b-4665bbf4b661/comprovante` devolveu 404. O atendente
precisa emitir algo fora do sistema; o cliente sai sem documento gerado pela venda registrada.

### A-22 — Produção “atualizada” é uma confirmação falsa *(P1, provado)*

O toast é disparado depois do insert único em `orders` e afirma que Produção e Financeiro foram
atualizados (`_app/pedidos.tsx:81-99`). Em Produção, a aba simplificada lê esse mesmo cabeçalho,
mas dashboard/PCP leem `production_order_items`/OPs e ficaram em zero
(`_app/producao.tsx:49-79`). Não há ficha técnica nem ordem imprimível para as fotos.

O quadro tenta mudar `orders.production_status` por drag-and-drop (`:82-89,118-137`), mas o
arrasto reproduzido não gerou update nem erro. Os rótulos finais foram aplicados por SQL somente
para testar a retirada, e não geraram histórico. Assim, nem a confirmação inicial nem o status
“Entregue” representam eventos operacionais auditáveis.

### A-23 — P2 precisa inventar produto, preço e rota de produção *(P2, provado)*

Não há produto de foto/10x15 no catálogo `store.products`. O modal manual exige texto e aceita
valor total arbitrário (`_app/pedidos.tsx:235-247`), sem preço unitário ou referência de catálogo.
Também não existe setor fotográfico entre as opções (`:249-261`). A classificação como
Sublimação é semanticamente falsa, mas obrigatória para não deixar o default Offset.

Sem SKU/item, nenhum insumo pode ser baixado. A jornada demonstra uma ausência de domínio, não
apenas de interface: o sistema não sabe que foram produzidas e entregues 50 unidades.

### Contornos e resíduos locais da J4

Contornos usados somente no espelho local, sem corrigir o produto:

- perfil temporário de P2 e troca temporária de `companies.owner_id` P1 → P2 para atravessar
  A-18; ambos **restaurados/removidos** no encerramento;
- prazo do pedido ajustado por SQL para o próprio dia, após o seletor descartar o formulário;
- `production_status` ajustado por SQL para `pronto` e depois `entregue`, após o drag falhar.

Foram mantidos como evidência local o cliente `P10 Balcão J4`
(`542d907e-cebd-4e42-9847-cf8cfeb6c82c`) e o pedido `PED-000002`
(`0ca3942b-607d-44dd-a47b-4665bbf4b661`). Nenhuma escrita foi feita em produção.

### Fechamento parcial após J4

**O que impede a venda de balcão amanhã:** P2 não pode operar o Flow (A-18); não há POS; o
pedido manual fica fora do Nexus e de todos os subsistemas operacionais (A-19); PIX/caixa
viram um rótulo (A-20); não há recibo (A-21).

**O que o atendente precisa inventar:** um cadastro persistente para o cliente, descrição do
produto, preço total, setor errado, controle externo do PIX/caixa, recibo externo e comprovação
externa da retirada. O e-mail falso especificamente **não é necessário**.

---

## Informação para a ordem de correção final (não é achado, é contexto)

Três migrações já escritas no repositório — **não aplicadas em produção** — resolvem boa parte
do bloqueio P0 original (A-01 do relatório de 16/08, numeração de documentos) e automatizam o
que hoje só o app faz manualmente (histórico de status, totais de cliente, notificação, baixa de
estoque com trava de saldo negativo, contagem de cupom, custo médio). Testei aplicá-las, em
ordem, sobre o dump real de produção no espelho local: **as seis aplicam limpo, sem erro**.
Ainda vou testar se o comportamento resultante bate com o que os `orders.ts`/`admin-ops.ts` do
Nexus-Printi esperam antes de recomendar o deploy — fica para a seção final de ordem de
correção, depois de fechar todas as jornadas.

---

## J5 — Revendedor *(P8, concluída em 22/08)*

**Resultado da jornada: falhou nos mecanismos comerciais e financeiros centrais.** P8 consegue
entrar, cadastrar cliente, criar sua própria tabela de margem e finalizar pedido depois do
contorno de A-06. Mas o preço de compra não é menor que o público, catálogo e calculadora
subestimam o custo, o cliente final não é ligado ao pedido, o crédito usado não é debitado e a
comissão configurada não nasce. A biblioteca de materiais está vazia.

### Respostas diretas da J5

| Pergunta | Resposta comprovada |
|---|---|
| O preço de revenda é realmente menor? | **Não.** Público e P8 pagam R$ 22,00 por 100 cartões; todas as faixas têm `reseller_unit_price = null` e P8 não tem tabela comercial atribuída. |
| P8 consegue ver custo ou margem? | **Sim, o próprio custo de compra e uma margem estimada.** `/revenda/produtos` e a calculadora mostram R$ 0,15 e margem de 25%, mas esses números estão errados para 100 unidades: o checkout cobra R$ 0,22. |
| Há vazamento de custo interno? | **Não foi encontrado.** O breakdown mostra somente a faixa comercial de R$ 0,22 e subtotal; HTML serializa `base_price`/`reseller_price`, mas não contém `cost_price` nem `supplier_cost`. O schema `store.products` também não possui campo de custo fabril. |
| A comissão é igual para revendedor e admin? | **Quando existe uma linha, sim.** Após inserir uma comissão QA de R$ 2,20, ambas as telas mostraram base R$ 22,00, 10% e R$ 2,20. O defeito é anterior: o pedido real não criou essa linha. |

### Checkpoints da jornada

| Checkpoint | Resultado | Evidência |
|---|---|---|
| Login e liberação de P8 | **Parcial** | sem perfil aparecia “Cadastro em análise”; P1 aprovou P8 e configurou 10%/R$ 500 |
| Produto e tabela própria | **Parcial** | tabela de margem própria salva, mas não existe tabela de preço Nexus atribuída |
| Preço menor que o público | **Falhou** | [público: R$ 22](evidencias/j5/02-preco-publico.png) e [P8: R$ 22](evidencias/j5/25-aprovado-ainda-paga-preco-publico.png) |
| Calculadora reflete o checkout | **Falhou** | [calculadora: custo R$ 15](evidencias/j5/07-calculadora-custo-incorreto.png), checkout: R$ 22 |
| Pedido em nome do cliente final | **Falhou** | [checkout sem seletor](evidencias/j5/14-checkout-sem-cliente-final.png); pedido ficou com `customer_id = null` |
| Pedido normal | **Parcial com contorno** | A-06 bloqueou; trigger QA permitiu criar `QA-J5-01000` por PIX |
| Lançamento de crédito pelo admin | **Falhou** | [toast de sucesso, saldo zero](evidencias/j5/27-credito-lancado.png); movimento ficou com `balance_after = 0` |
| Compra com crédito | **Falhou criticamente** | [pedido pago](evidencias/j5/31-pedido-credito-criado.png), mas [saldo continua R$ 30](evidencias/j5/32-saldo-nao-baixou.png) e não há débito |
| Comissão automática de 10% | **Falhou** | [P8 zerado](evidencias/j5/33-p8-comissoes-zero.png) e [admin zerado](evidencias/j5/34-admin-comissoes-zero.png) após os pedidos |
| Consistência visual da comissão | **Passou com dado QA** | [P8: R$ 2,20](evidencias/j5/35-p8-comissao-contornada.png) e [admin: R$ 2,20](evidencias/j5/36-admin-comissao-contornada.png) |
| Materiais comerciais | **Falhou por ausência** | [nenhum material publicado](evidencias/j5/37-materiais-vazios.png) |
| Breakdown sem custo interno | **Passou** | [somente faixa base e subtotal](evidencias/j5/38-breakdown-sem-custo-interno.png) |

### O fluxo executado

1. P8 entrou em `/revenda` sem linha em `store.reseller_profiles`. O painel tratou a ausência
   como cadastro em análise e declarou que seriam aplicados preços padrão. Prova:
   [dashboard sem perfil](evidencias/j5/03-p8-dashboard-sem-perfil.png).
2. Em **Produtos para revenda**, o cartão prometeu “Seu preço” de R$ 0,15, venda sugerida de
   R$ 0,20 e margem de 25%. A página real do produto, autenticada como P8, calculou R$ 22,00
   para 100 unidades — os mesmos R$ 22,00 do visitante anônimo. Provas:
   [promessa no painel](evidencias/j5/04-produtos-prometem-preco-margem.png) e
   [preço efetivo](evidencias/j5/05-preco-revendedor-real.png).
3. A calculadora repetiu o problema: custo unitário R$ 0,15, custo total R$ 15,00 e venda
   sugerida R$ 20,00. Ela permite ao revendedor cotar abaixo dos R$ 22,00 que pagará.
4. **Tabelas de margem** não encontrou nenhuma tabela comercial Nexus. P8 criou
   `QA-J5 Varejo 30%`; ela serve apenas para calcular o preço que P8 quer cobrar do cliente,
   não altera seu custo de compra. Provas: [estado vazio](evidencias/j5/08-tabelas-vazias.png)
   e [tabela própria salva](evidencias/j5/10-tabela-propria-criada.png).
5. P8 cadastrou `P8 Cliente Final J5`, persistido com `owner_reseller_id = P8` e
   `profile_id = null`. No checkout não apareceu seletor nem busca desses clientes. Mesmo ao
   digitar seus dados no faturamento, a compra não cria o vínculo: a ação procura apenas um
   cliente com `profile_id = auth.uid()` (`orders.ts:297-324`).
6. O primeiro envio do checkout falhou por A-06. Com um trigger temporário apenas no espelho,
   foram criados `QA-J5-01000` (PIX, R$ 22,00) e `QA-J5-01001` (crédito interno). Ambos têm
   `reseller_id = P8`, `customer_id = null`; o segundo ficou `pago`, `credit_used = 22` e
   `total = 0`.
7. P8 solicitou limite de R$ 500. P1 aprovou o perfil com limite R$ 500, comissão 10% e prazo
   “30 dias após a entrega”; a solicitação continuou `pendente`, sem revisão. Provas:
   [solicitação no admin](evidencias/j5/21-admin-ve-solicitacao.png) e
   [limite configurado, pedido pendente](evidencias/j5/23-revendedor-aprovado-limite-pendente.png).
8. P1 lançou R$ 30 de crédito e recebeu confirmação de sucesso, mas `profiles.credit_balance`
   continuou zero e o movimento nasceu com `balance_after = 0`. Para atravessar esse bloqueio,
   o saldo foi temporariamente colocado em R$ 30 por SQL local.
9. `QA-J5-01001` consumiu R$ 22 na tela e foi marcado pago. No banco não surgiu movimento
   `debito`, o único movimento continuou sendo o crédito administrativo inconsistente e o
   perfil permaneceu em R$ 30. Também não surgiu linha em `store.payments`; apenas um
   `finance_entry` pago de valor zero. O código ignora os erros dos inserts de pagamento e
   crédito (`orders.ts:390-415`).
10. Mesmo com `commission_pct = 10`, os dois pedidos deixaram `store.commissions` vazio. Para
    responder à comparação de visões, foi inserida manualmente uma linha QA ligada a
    `QA-J5-01001`: base R$ 22,00, 10%, comissão R$ 2,20, status previsto. P8 e P1 exibiram os
    mesmos números; a UI e a RLS de leitura funcionam.
11. A página de materiais informou “Nenhum material publicado ainda”. O banco contém zero
    `marketing_assets`; P8 também não tem liberação whitelabel. Não foi possível testar download
    de catálogo, mockup ou arte porque nenhum artefato existe.

### A-24 — Crédito interno pode ser reutilizado indefinidamente *(P0, provado)*

O checkout autoriza o desconto lendo `profiles.credit_balance` e calcula
`creditUsed = min(saldo, total)` (`orders.ts:282-293`). Depois do pedido, tenta inserir um débito
em `credits`, mas ignora o erro (`:407-414`). No banco real espelhado, `store.credits` não tem
trigger para calcular `balance_after` nem atualizar o perfil.

O teste foi direto: saldo local de R$ 30,00, pedido de R$ 22,00, `credit_used = 22`, pedido e
pagamento marcados como pagos; após a compra, saldo ainda R$ 30,00 e zero movimentos de débito.
Assim, a mesma disponibilidade pode pagar novos pedidos. A migração ainda não aplicada
`20260816000003_automacoes_estoque_credito.sql:9-12,122-180` descreve e corrige exatamente essa
lacuna, mas ela não protege o ambiente atual.

### A-25 — O revendedor não recebe preço menor que o público *(P1, provado)*

Para o produto auditado, `reseller_price` é nulo e todas as cinco faixas têm
`reseller_unit_price = null`. A função de preço usa explicitamente o preço público da faixa como
fallback (`pricing.ts:221-224`). Também há zero linhas em `store.price_tables` e
`profiles.price_table_id` de P8 é nulo.

Resultado observado: visitante anônimo e P8 aprovado pagam R$ 0,22 por unidade, R$ 22,00 em
100 cartões. O rótulo “PREÇO DE REVENDA” muda, o valor não. A tabela de margem criada por P8 é
uma configuração de markup para seus orçamentos, não uma tabela de compra Nexus.

### A-26 — Catálogo e calculadora inventam uma margem com custo errado *(P1, provado)*

`/revenda/produtos` calcula `reseller_price ?? base_price` sem consultar faixas
(`revenda/produtos/page.tsx:84-87`). A calculadora repete a fórmula
(`margin-calculator.tsx:44-50`). Para este produto, isso vira R$ 0,15, embora a faixa mínima
vigente de 100 unidades custe R$ 0,22.

O painel recomenda vender 100 peças por R$ 20,00 e chama R$ 5,00 de lucro; na compra real P8
pagaria R$ 22,00 e teria prejuízo de R$ 2,00. O dashboard ainda calculou “Margem estimada” de
R$ 6,60 sobre a compra, sem registrar por quanto o cliente final foi cobrado. Não é apenas uma
diferença de apresentação: a ferramenta comercial orienta preço abaixo do custo efetivo.

### A-27 — Comissão do revendedor nunca é gerada pelo pedido *(P1, provado)*

A configuração administrativa salvou `reseller_profiles.commission_pct = 10`, mas
`createOrderAction` só procura `sellerId`, lê `seller_profiles` e insere comissão com papel
`vendedor` (`orders.ts:453-470`). Não existe ramo equivalente para `reseller_id`.

Os pedidos de P8 deixaram a tabela vazia e ambas as telas mostraram zero. A linha QA manual
provou que as duas visões leem `store.commissions` corretamente: P8 filtra pelo próprio
`profile_id` (`revenda/comissoes/page.tsx:31-41`) e o admin lê o conjunto completo
(`admin/comissoes/page.tsx:36-45`). Portanto, uma vez gerado o lançamento, o valor é idêntico;
hoje a geração automática não acontece.

### A-28 — Cliente final do revendedor não participa do checkout *(P2, provado)*

O cadastro funciona e grava `owner_reseller_id` (`customers.ts:66`), mas o checkout não oferece
seletor. Na criação do pedido, a busca é por `customers.profile_id = user.id`
(`orders.ts:297-303`), relação usada para o próprio comprador da loja, não pelos clientes
gerenciados por P8. `QA-J5-01000` e `QA-J5-01001` ficaram com `customer_id = null`.

P8 pode manter uma agenda e preencher manualmente dados de faturamento, mas não consegue emitir
o pedido “em nome” do cliente cadastrado nem obter histórico, total comprado ou rastreabilidade
por esse cliente.

### A-29 — Aprovar limite não conclui a solicitação *(P2, provado)*

Solicitar limite cria uma linha pendente (`customers.ts:201-230`). O formulário administrativo
atualiza somente `reseller_profiles` (`admin-ops.ts:448-478`); não aprova, recusa nem vincula a
solicitação correspondente. Depois de P1 configurar exatamente os R$ 500 pedidos, a linha
continuou `pendente`, com `reviewed_by`, `reviewed_at` e `review_note` nulos.

Isso mantém fila e status divergentes: o limite já existe no perfil, mas P8 e admin continuam
vendo uma solicitação em aberto.

### A-30 — Não há material comercial publicado para o revendedor *(P2, provado)*

A tela consulta `marketing_assets` ativos e filtra whitelabel conforme o perfil
(`revenda/materiais/page.tsx:23-33`). A consulta encontrou zero linhas, e a UI informou que não
há material publicado. O controle de acesso está desenhado, mas a entrega comercial prometida
— catálogos, mockups e artes — está vazia no ambiente auditado.

### Custo, margem e superfície de exposição

O revendedor vê intencionalmente `reseller_price`/`base_price`, sua quantidade, subtotal e a
margem que ele mesmo escolhe. Isso é necessário para revender e não foi classificado como
vazamento. No breakdown de `QA-J5-01001`, o snapshot contém somente “Preço base por unidade”,
faixa a partir de 100 e R$ 0,22.

Na inspeção do HTML autenticado, `base_price` e `reseller_price` aparecem no payload RSC;
`cost_price` e `supplier_cost` não aparecem. Não existe requisição direta do navegador ao
Supabase nessa página — os dados chegam pelo documento/Server Component. Também não há coluna
de custo fabril em `store.products`. Assim, **não foi encontrada exposição do custo interno da
Nexus**, embora a palavra “custo” usada pela calculadora represente o preço que P8 deveria pagar
e esteja incorreta por A-26.

### Contornos e resíduos locais da J5

Usados somente no espelho local, sem correção de produto ou escrita em produção:

- trigger/função temporários `qa_j5_orders_set_number` / `store.qa_j5_set_order_number()` para
  atravessar A-06; removidos no encerramento;
- `profiles.credit_balance = 30` aplicado manualmente para atravessar a falha do lançamento;
  restaurado para zero no encerramento;
- comissão `10344cbf-e638-4c21-8931-87ade285d52c`, R$ 2,20, inserida manualmente para comparar
  P8 e P1; mantida como dado QA, claramente marcada na coluna `note`.

Foram mantidos como evidência local o perfil comercial aprovado de P8, tabela de margem
`4e4dd1ef-e58e-49a4-a244-448cfe3075d5`, cliente final
`740bb6b4-1257-4f89-8df7-47a26b704905`, solicitação de limite
`44156b66-226a-4d4a-b3d8-a8249e185440`, movimento de crédito
`cb8d9a74-beac-4b78-b764-b99f8c9038a2` e pedidos `QA-J5-01000`/`QA-J5-01001`. Nenhuma correção
de produto foi feita.

### Fechamento parcial após J5

**O que impede a operação de revenda amanhã:** não existe vantagem de preço (A-25), as
ferramentas sugerem venda abaixo do custo real (A-26), o crédito é reutilizável (A-24), a
comissão não nasce (A-27) e o cliente final não acompanha o pedido (A-28). A-06 ainda bloqueia
qualquer checkout sem o contorno local.

**O que funciona:** login e áreas de P8, cadastro do cliente, tabela própria de markup, leitura
da comissão quando a linha existe e segregação do breakdown sem custo interno. Esses pontos não
compensam os bloqueios financeiros e comerciais acima.

---

*Aguardando confirmação para seguir para J6.*
