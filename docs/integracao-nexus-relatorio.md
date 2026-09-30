# Integração PrintiFlow → Nexus Printi — relatório final

28/09 a 30/09/2026. Banco compartilhado `gkbbzypdakjrvxwvfjlc`.
Site `Nexus-Printi` (Next.js) e CRM `Printiflow` (TanStack Start), ambos na Vercel.

## 1. Arquitetura final

```
Fornecedor (FuturaIM)
   │  importador do CRM (link, lote ou catálogo; fila persistente; dedup por URL/código/nome)
   ▼
public.products + grafo (variantes, tiragens, imagens, gabaritos, extras)      ← dono: Flow
   │  alteração em qualquer tabela do grafo (gatilhos) ─► store.product_sync_queue
   │                                                     (1 item aberto por produto, janela 30 s,
   │                                                      tentativas 1/4/16/64 min, pg_cron 1×/min)
   │  publicação manual ou pela fila
   ▼
store.publish_crm_product (permissão) → publish_crm_product_internal (hash, noop, validação, log)
                                       → publish_crm_product_apply (montagem do catálogo)
   ▼
store.products + imagens/opções/variantes/tiragens (loja)   ── content_hash = assinatura publicada
   │
   ├─ store.product_sync_state / store.crm_product_sync_health: status REAL
   │     synced · stale (Flow mudou) · attention (loja editada/órfão) · error · archived · pending
   ├─ despublicar / arquivar (motivo obrigatório; nunca apaga produto publicado)
   └─ painel "Integração Nexus" no CRM (só equipe da loja)

Pedido na loja → store.orders ─► espelho public.orders (CRM) · finance_entries · production_orders
```

Regras de posse: produto `sync_origin = 'crm'` é do Flow (crm_id único, obrigatório); `site` é
nativo da loja e nunca é tocado pela publicação. O banco impede trocar a origem de um produto.

## 2. Migrações (todas aplicadas em produção)

| Versão | O que faz | Reversão |
|---|---|---|
| 20260929010000 | Campos de sync (hash, source_updated_at, last_sync_error), 8 status, posse verificada, updated_at confiável no Flow | `supabase/rollback/…010000…down.sql` |
| 20260929020000 | Publicação canônica: validação, hash, noop, falha registrada sem dado parcial | `…020000…down.sql` |
| 20260929030000 | Status real, fila persistente, gatilhos no grafo do Flow | `…030000…down.sql` |
| 20260929030100 | pg_cron processa a fila a cada minuto | `…030100…down.sql` |
| 20260929040000 | Despublicar/arquivar, exclusão só de nunca publicado, admin da loja arquiva produto do Flow | `…040000…down.sql` |
| 20260929050000 | Painel de saúde visível só para a equipe (fechou vazamento para clientes) | `…050000…down.sql` |
| 20260929060000 | Assinatura lê colunas privadas das variantes (painel e catálogo davam "permission denied") | `…060000…down.sql` |
| 20260930010000 | Retirada pelo Flow não parece mais "edição na loja" na republicação | `…010000…down.sql` |

Cada reversão foi ensaiada: aplicar → testar → reverter (testes da fase falham, anteriores passam) →
reaplicar.

## 3. Arquivos modificados

**CRM (`Printiflow`)** — 17 commits, `8d48e2b..9ef67f2`:
- Ambiente: `vite.config.ts` (build de produção recusa Supabase local), `src/lib/app-env.ts`,
  selo de ambiente em `src/components/app-header.tsx`.
- Publicação: `src/lib/store-publication.ts`, `src/lib/product-sync.ts`, `src/routes/_app/produtos.tsx`,
  `src/routes/_app/produtos-site.tsx`.
- Importador: `src/components/products/importador-produtos.tsx`, `src/lib/importer-publication.ts`,
  `src/lib/importer-jobs.ts`, `src/lib/importer-persistence.ts`, `src/types/importedProduct.ts`.
- Painel: `src/routes/_app/integracao-nexus.tsx`, `src/lib/integration-health.ts`, menu lateral.
- Banco: 8 migrações, 8 reversões, 7 testes SQL (`supabase/tests/`).
- Ensaio e homologação: `scripts/db-rehearsal.sh`, `scripts/homolog-local.sh`, `supabase/homolog/`,
  `supabase/config.toml` (schema `store` na API local), `scripts/homolog-e2e/`.

**Site (`Nexus-Printi`)** — 3 commits, `bbdc166`, `02256df`, `623667a`:
- `src/lib/actions/admin.ts` (cópia de produto do Flow nasce nativa; mensagens da exclusão).
- `src/lib/actions/orders.ts` (segunda compra; cancelamento cancela cobrança).
- `src/lib/actions/production.ts` (exportação que quebrava as ações do pedido no admin).
- `src/lib/supabase/config.ts` (homologação só em `next dev`), `src/types/index.ts`.

## 4. Testes executados

| Conjunto | Resultado |
|---|---|
| CRM, unitários (vitest) | 295 passando, 31 arquivos (89 novos na integração) |
| SQL (`supabase/tests/10…70`) | 7/7 na cópia da produção com permissões reais e 7/7 na homologação |
| Jornada ponta a ponta (`scripts/homolog-e2e/jornada.cjs`) | 10/10 etapas |
| Prova de que os testes pegam erro | teste SQL com expectativa invertida, gatilho removido, proteção de status removida e defeito do checkout recolocado: todos falham como deveriam |
| Builds | CRM e site compilam; build do site sem nenhuma referência a banco local |
| Tipos | CRM: 86 erros antigos em 7 telas fora da integração, nenhum novo. Site: limpo |
| Lint | CRM: 12.969 erros antigos (97% formatação Prettier/CRLF, 328 `any`), 0 nos arquivos da integração. Site: 0 erros, 33 avisos antigos, 0 nos arquivos alterados |

## 5. Jornada completa (homologação local, 30/09/2026)

Importação → publicação → atualização de preço (fila, sem intervenção) → visualização no site →
cadastro do cliente → pedido → CRM (mesmo número e valor) → pagamento → financeiro → produção →
acompanhamento pelo cliente → cancelamento → arquivamento → republicação. **Todas as etapas ok.**
Idempotência comprovada: envio duplo do checkout gera um pedido; republicar sem mudança é noop;
reimportar atualiza sem duplicar.

Defeitos encontrados pela jornada e corrigidos em produção:
1. Segunda compra de cliente logado devolvia o pedido anterior e apagava os itens novos.
2. "Confirmar pagamento" e "Gerar ordens de produção" no admin da loja não faziam nada.
3. Cancelar deixava a cobrança Pix pendente.
4. Republicar depois de arquivar acusava edição na loja inexistente.
5. Links de fornecedor com `utm_*` não eram reconhecidos como o mesmo produto.

## 6. Pendências de reconciliação

- Os 2 órfãos do plano e o Cartão de Visita antigo foram **excluídos em 28/09 às 23:00** pela
  migração `20260928150000` (anterior a este trabalho). Não há backup deles; o `store.sync_log`
  guarda nomes e ids. Proposta: aceitar (`backups/RECONCILIACAO-PRODUTOS.md`).
- Os 32 produtos nativos de mockup foram excluídos pelo admin da loja em 29/09 (sem referência
  comercial). Nada pendente.
- Pedido real `NP-26-01004` (28/09, R$ 50,40) segue aguardando pagamento.

## 7. Riscos e decisões em aberto

| Tema | Situação | Recomendação |
|---|---|---|
| Dois quadros de produção | Ordens nascem em `store.production_orders`; o PCP do CRM lê `public.production_order_items`, que não recebe nada | Decidir qual é o oficial e ligar o outro a ele |
| Checkout não mostra descontos | Cliente vê R$ 56,98, pedido sai R$ 53,05 (Pix 5% e retirada) | Mostrar os descontos na prévia; mexe em `pricing.ts`/configurador |
| Etapa da OP x situação do pedido | Independentes; podem se contradizer | Definir quem manda |
| Histórico duplicado no cancelamento | Ação e gatilho gravam a mesma transição | Passar o motivo ao gatilho |
| `payment_status` do pedido cancelado | Continua "pendente" | Ajustar junto com o item acima |
| Reimportar sobrescreve preço editado à mão | Comportamento esperado | Orientar a operação |
| Sem homologação na nuvem | Homologação é local (Docker) | Repetir a jornada antes de mudanças grandes |
| Previews da Vercel do CRM | Usam o banco de produção | Evitar testar em preview |

## 8. Implantação e reversão

Implantação (a mesma ordem usada até aqui):
1. Backup: `pg_dump --schema=store --schema=public --schema=private --format=custom --no-owner`.
2. Ensaio: `bash scripts/db-rehearsal.sh restore <dump>` → `apply <migrações novas>` → `test`.
3. Aplicar cada migração numa transação e registrar a versão:
   `psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 -f <migração>` e
   `insert into supabase_migrations.schema_migrations(version, name) values (…)`.
4. Push do CRM e do site (a Vercel publica). Nunca antes da migração de que o código depende.
5. Conferir: painel Integração Nexus; `select * from store.crm_product_sync_health` como equipe;
   `cron.job_run_details` sem falhas.

Reversão: aplicar os arquivos de `supabase/rollback/` na ordem inversa, cada um numa transação,
e apagar a versão de `supabase_migrations.schema_migrations`; reverter o deploy na Vercel
(promover o deploy anterior). Backups antes de cada fase estão em `backups/`.
