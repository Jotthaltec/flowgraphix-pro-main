# Plano de saneamento e simplificação do PrintFlow CRM

## Visão geral

O objetivo é reduzir código morto, remover interfaces enganosas, consolidar caminhos duplicados e criar proteção automática contra a volta desses problemas. O trabalho será incremental: cada fase deve terminar com testes, build e lint verdes antes da próxima.

## Prioridades e esforço

| Prioridade | Fase | Resultado | Esforço estimado |
|---|---|---|---|
| P0 | 1. Baseline e UX honesta | Pipeline verde e controles sem ação removidos/desabilitados | 2–4 h |
| P0 | 2. Barreira contra código morto | 64 símbolos órfãos removidos e detecção ativada | 3–5 h |
| P1 | 3. Código inalcançável | Componentes/módulos mortos e dependências correspondentes removidos | 3–6 h |
| P1 | 4. Caminhos canônicos | Um cliente Supabase e um motor de combinações | 3–5 h |
| P2 | 5. Utilitários e cache | Formatação, status, normalização e query keys centralizados | 4–8 h |
| P2 | 6. Domínio de produtos | CRUD e invalidação de produtos centralizados em hooks/repositório | 8–12 h |
| P3 | 7. Decomposição e testes de UI | Componentes grandes divididos e fluxos críticos testados | 2–4 dias |
| Decisão | 8. Revalidação de orçamento | Concluir verticalmente ou remover o protótipo | 1–2 dias |

Estimativa total do saneamento obrigatório (fases 1–7): 4–6 dias de trabalho focado. A fase 8 é uma decisão de produto separada.

## Decisões arquiteturais

- O fluxo canônico de orçamento para pedido é `store.convert_quote_to_order`; não conectar o serviço frontend antigo de criação de OP sem revisar a regra transacional do banco.
- O cliente canônico do navegador é `src/integrations/supabase/client.ts`.
- O motor ativo de combinações usa `combination-client.ts` com sessão e RLS. A implementação server-side sem consumidores é candidata a remoção.
- Não misturar saneamento com novas funcionalidades. Busca global, notificações, Google Maps e revalidação só serão implementados mediante escopo próprio.
- Arquivos gerados (`routeTree.gen.ts` e tipos Supabase) não devem ser editados manualmente.

## Dependências

```text
Fase 1: baseline confiável
  -> Fase 2: detectar código órfão automaticamente
      -> Fase 3: remover código inalcançável
          -> Fase 4: consolidar caminhos canônicos
              -> Fase 5: utilitários e cache
                  -> Fase 6: domínio de produtos
                      -> Fase 7: decomposição e testes de UI

Fase 8 depende de uma decisão humana e do caminho canônico definido na Fase 4.
```

## Fases

### Fase 1 — Baseline e UX honesta (P0)

- Corrigir os erros atuais do lint e o `useEffect` do editor que lê `product` com dependência incompleta.
- Remover ou apresentar como indisponíveis a busca, notificações e botão “Novo” do cabeçalho.
- Substituir o formulário de Google Maps por uma chamada de ação explicitamente indisponível, sem campos que fingem participar da busca.
- Não implementar novas integrações nesta fase.

Critério de saída: lint, 345+ testes e build verdes; nenhum controle visível promete uma ação inexistente.

### Fase 2 — Barreira contra código morto (P0)

- Remover os 64 imports, parâmetros, tipos e variáveis sem uso, em mudanças pequenas por domínio.
- Ativar `noUnusedLocals`, `noUnusedParameters` e `@typescript-eslint/no-unused-vars` com exceções explícitas somente quando justificadas.
- Manter componentes exportados fora desta etapa; exports exigem análise de alcançabilidade da Fase 3.

Critério de saída: TypeScript e ESLint detectam novos símbolos órfãos automaticamente.

### Fase 3 — Código inalcançável e dependências (P1)

- Remover os 23 wrappers de UI sem importadores confirmados.
- Revisar e remover as dependências npm que só sustentavam esses wrappers.
- Remover módulos sem importadores e sem caminho de negócio aprovado, após conferir referências estáticas e dinâmicas.
- Preservar temporariamente o protótipo de revalidação até a decisão da Fase 8.

Critério de saída: nenhum arquivo removido aparece no grafo de produção/testes; lockfile atualizado apenas pelo gerenciador de pacotes; build sem regressões.

### Fase 4 — Caminhos canônicos (P1)

- Remover o cliente Supabase legado.
- Remover a implementação duplicada e inativa de combinações server-side, mantendo o caminho autenticado com RLS.
- Remover o serviço frontend antigo de geração de OP somente depois de confirmar que os fluxos reais usam as funções transacionais `store.*`.
- Documentar em comentários curtos apenas os limites arquiteturais que não são óbvios.

Critério de saída: um único caminho por operação; nenhuma chave administrativa introduzida no cliente.

### Fase 5 — Utilitários, status e cache (P2)

- Criar utilitários canônicos para BRL e datas civis/data-hora.
- Reutilizar `normalizeKey` ou extrair uma normalização compartilhada para o motor/importador.
- Centralizar labels/variantes de status por domínio, sem criar um mapa global genérico.
- Criar fábricas tipadas de query keys para produtos, importações, pedidos e orçamentos.

Critério de saída: não existem novos formatadores locais equivalentes nem strings de cache duplicadas nos domínios migrados.

### Fase 6 — Domínio de produtos (P2)

- Extrair leitura, criação, edição, duplicação, arquivamento e exclusão para uma camada de domínio/repositório.
- Criar hooks de query/mutation com invalidação centralizada.
- Migrar uma fatia por vez: lista principal, editor, Hub e importador.
- Manter payloads e regras atuais; refatoração não deve alterar comportamento.

Critério de saída: componentes de produtos não montam payloads Supabase duplicados nem repetem invalidações manualmente.

### Fase 7 — Decomposição e testes de UI (P3)

- Dividir primeiro `product-editor.tsx`, `produtos-importados.tsx` e `produtos.tsx` por responsabilidade.
- Depois dividir os construtores de orçamento e seletores de combinação.
- Adicionar testes de componente/fluxo para produto, orçamento -> pedido e produção.
- Evitar snapshots grandes; testar comportamento observado pelo usuário.

Critério de saída: nenhum novo componente de página ultrapassa aproximadamente 600–800 linhas sem justificativa; fluxos críticos têm testes de regressão.

### Fase 8 — Decisão de produto: revalidação (separada)

Opção recomendada: concluir a revalidação antes da conversão de orçamento para pedido, pois ela protege margem quando o custo do fornecedor muda. Se não fizer parte do produto, remover em conjunto dialog, snapshot e endpoints órfãos.

Critério de saída se implementada: snapshot criado ao salvar, comparação executada antes da conversão e decisão do operador auditável. Se removida: nenhum tipo, tabela cliente ou componente órfão permanece.

## Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Apagar componente carregado indiretamente | Alto | Grafo estático + busca por import dinâmico + build de produção |
| Quebrar regra transacional de pedido/produção | Alto | Preservar RPCs `store.*` e testar jornada real |
| Refatorar produto e alterar payload | Alto | Testes de caracterização antes da migração |
| Grande mudança difícil de revisar | Médio | Um commit/fatia por tarefa, até cerca de 300 linhas alteradas |
| Centralização virar abstração genérica demais | Médio | Utilitários específicos por domínio e só após repetição comprovada |

## Verificação padrão de toda fase

- `npm run lint`
- `npm test`
- `npm run build`
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false`
- Revisão do diff e confirmação de que arquivos não relacionados não foram alterados

