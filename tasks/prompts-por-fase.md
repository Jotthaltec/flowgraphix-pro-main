# Prompts de execução — saneamento do PrintFlow CRM

Execute um prompt por vez e só avance quando o checkpoint estiver verde.

## Prompt da Fase 1 — Baseline e UX honesta

Analise o PrintFlow CRM e implemente somente a Fase 1 do plano em `tasks/plan.md`. Corrija os erros atuais do lint, corrija o efeito do `ProductEditor` que lê o objeto `product` com dependência incompleta e trate os controles sem ação do cabeçalho (busca, notificações e “Novo”) de forma honesta: remova-os ou deixe-os explicitamente indisponíveis, sem inventar novas funcionalidades. Na tela de Leads, remova a aparência de formulário funcional da busca Google Maps atualmente desativada e apresente o estado indisponível de forma clara. Preserve todos os fluxos existentes. Rode lint, testes, build e TypeScript com verificações de não usados apenas para diagnóstico. Faça revisão do diff e pare ao concluir esta fase.

## Prompt da Fase 2 — Barreira contra código morto

Implemente somente a Fase 2 de `tasks/plan.md`. Remova os 64 imports, variáveis, parâmetros e tipos sem uso em mudanças organizadas por domínio, sem apagar exports apenas porque parecem órfãos. Em seguida, ative `noUnusedLocals`, `noUnusedParameters` e `@typescript-eslint/no-unused-vars`, usando exceções pontuais e justificadas para parâmetros intencionalmente ignorados. Não faça refatorações arquiteturais. Rode lint, testes, build e TypeScript estrito; o critério final é zero diagnóstico de código não usado.

## Prompt da Fase 3 — Código inalcançável e dependências

Implemente somente a Fase 3 de `tasks/plan.md`. Recalcule o grafo de módulos incluindo imports estáticos, dinâmicos, rotas e testes. Remova apenas arquivos comprovadamente inalcançáveis, começando pelos wrappers de UI sem importadores. Atualize `package.json` e o lockfile removendo somente dependências que ficaram sem consumidor; não edite o lockfile manualmente. Preserve os artefatos de revalidação de orçamento para a decisão da Fase 8. Verifique lint, testes e build, documente tudo que foi removido e pare.

## Prompt da Fase 4 — Caminhos canônicos

Implemente somente a Fase 4 de `tasks/plan.md`. Preserve como canônicos `src/integrations/supabase/client.ts`, o fluxo de combinações autenticado com RLS e as RPCs transacionais `store.*`. Remova o cliente Supabase legado e a implementação server-side inativa do motor de combinações após comprovar que não possuem consumidores. Investigue se `services/production.ts` foi totalmente substituído pelas RPCs de pedido/pagamento/produção; só o remova com evidência e testes da jornada orçamento -> pedido -> pagamento/produção. Não introduza service-role no navegador. Rode todas as verificações e pare.

## Prompt da Fase 5 — Utilitários, status e query keys

Implemente somente a Fase 5 de `tasks/plan.md` em fatias pequenas. Crie utilitários canônicos e testados para moeda BRL, datas civis e data/hora. Elimine a normalização literal duplicada entre motor e importador reutilizando uma função canônica. Centralize labels e variantes de status dentro de cada domínio, sem criar um mapa global genérico. Crie fábricas tipadas de query keys para produtos, importações, pedidos e orçamentos e migre seus consumidores. Preserve comportamento e formato visual. Rode testes focados após cada fatia e o pipeline completo no final.

## Prompt da Fase 6 — Domínio de produtos

Implemente somente a Fase 6 de `tasks/plan.md`, por fatias verticais. Antes de refatorar, escreva testes de caracterização para os payloads e regras atuais. Extraia uma camada canônica de domínio para leitura, criação, edição, duplicação, arquivamento e exclusão de produtos, além de hooks de query/mutation com invalidação centralizada. Migre nesta ordem: lista principal, `ProductEditor`, Hub de Fornecedores e importador. Não altere schema, RLS ou comportamento funcional. Cada fatia deve compilar e passar nos testes antes da seguinte.

## Prompt da Fase 7 — Decomposição e testes de UI

Implemente somente a Fase 7 de `tasks/plan.md`. Configure testes de componentes compatíveis com React 19 e o stack atual, preferindo bibliotecas já instaladas; justifique qualquer nova dependência. Divida primeiro `product-editor.tsx`, `produtos-importados.tsx` e `produtos.tsx` por responsabilidade, mantendo APIs pequenas e regras no domínio. Depois faça o mesmo com o construtor de orçamento e o seletor de combinações. Cubra os fluxos observáveis de criar/editar produto, converter orçamento em pedido e acompanhar produção. Evite snapshots extensos. Verifique lint, testes, build e uma navegação manual dos fluxos.

## Prompt da Fase 8A — Concluir revalidação de orçamento

Implemente a revalidação de orçamento como uma fatia vertical completa. Ao salvar um orçamento de fornecedor, persista um snapshot imutável e auditável dos custos, opções, extras, frete e prazo. Antes de `store.convert_quote_to_order`, recalcule/consulte os valores atuais e apresente diferenças de preço, prazo, disponibilidade e margem. Exija uma decisão explícita do operador para manter preço, recalcular ou solicitar aprovação, registrando a decisão. Reutilize o dialog e tipos existentes apenas se continuarem adequados; remova o que for substituído. Inclua testes de autorização, idempotência, preço indisponível e concorrência. Não exponha chaves administrativas no cliente.

## Prompt da Fase 8B — Remover revalidação de orçamento

O produto decidiu não oferecer revalidação de orçamento. Remova de forma completa e segura o dialog, builder de snapshot, endpoints e tipos que existam somente para essa funcionalidade. Confirme referências estáticas, dinâmicas, migrações e tabelas antes de alterar banco; não remova schema ou dados persistidos sem uma migração separada e aprovação explícita. Atualize documentação e dependências, rode lint, testes e build e apresente a lista final de artefatos removidos.

