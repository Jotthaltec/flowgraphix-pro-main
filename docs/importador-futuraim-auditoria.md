# Auditoria — Importador de Produtos por Link (FuturaIM)

> Status: **Fundação testável entregue** (parser/normalizador/classificador/backend seguro + migrations + testes contra HTML real). Itens de fila/Playwright/storage/atualização de preços e a tela `/produtos/importar` dedicada são fases seguintes (ver "Limitações" e "Melhorias futuras").

## 1. Arquitetura adotada

O projeto é **TanStack Start** (`createServerFn`), não Vite + Supabase Edge Functions. Por decisão registrada, o backend seguro foi implementado como **server function** (server-side real, sem expor chaves/lógica ao frontend), e não como Edge Function Deno. Isso atende integralmente os requisitos de segurança da seção 4.

## 2. Links reais testados

Páginas reais da FuturaIM baixadas e versionadas como fixtures de teste em
`src/services/__tests__/fixtures/`:

| Produto | URL | id externo | Categoria detectada | Subcategoria |
|---|---|---|---|---|
| Cartão de Visita Couché Fosco | `/produto/cartao-de-visita-em-couche-fosco-com-laminacao-fosca-e-verniz-localizado?id=4627` | 4627 | Impressos Promocionais | Cartão de Visita |
| Banner Personalizado | `/produto/banner-personalizado?id=22502` | 22502 | Comunicação Visual | Banner |
| DTF UV | `/produto/dtf-uv?id=87625` | 87625 | Adesivos e Rótulos | DTF UV |
| Camiseta Dry Fit Masculina | `/produto/camiseta-dry-fit-masculina?id=103154` | 103154 | Vestuário e Têxtil | Camiseta |
| Adesivo em Vinil | `/produto/adesivo-em-vinil?id=11867` | 11867 | Adesivos e Rótulos | Adesivo em Vinil |
| Canecas Personalizadas | `/produto/canecas-personalizadas-porcelana?id=16448` | 16448 | Brindes e Personalizados | Caneca |

**DTF UV ≠ DTF Têxtil** validado por teste explícito (seção 32).

## 3. Estrutura real da FuturaIM (engenharia reversa)

Cada página de `/produto/...?id=NNN` é **server-rendered**. Fontes de dados, em ordem de confiança:

1. **JSON-LD `@type=Product`** → `name`, `image[]` (webp/png em alta), `description`, `sku` (= `?id=`), `brand.name`, `offers.price`/`priceCurrency`/`availability`/`url`, `review[]`.
2. **JSON-LD `@type=Service`** → extras reais (ex.: *Criação de Arte* R$ 45,99, *Revisão de Arquivo* R$ 16,99).
3. **GTM `dataLayer` `view_item`** → `item_id`, `item_name` (descritor completo da variante), `item_category` (família), `price`, `item_brand`.
4. **Tabela de tiragens** → `<tr onclick="trocarProduto('slug', <skuId>)">` com quantidade, preço unitário e total; **cada tiragem é um SKU real distinto** (ex.: 100/500/1000/5000/10000/20000).
5. **Eixos de variação** → `<select data-type=Formato>` e grupos `grupo-sku-*` / links `title="Ver produto no Material ..."`, com `<option>`/`href` apontando para `/produto/...?id=NNN` **reais**.
6. **Breadcrumb** schema.org (`<ol class=breadcrumb>` com `itemprop=name`).
7. **Open Graph** (`og:title`, `og:image`) como fallback.

## 4. Campos encontrados / não encontrados

**Encontrados (estáticos, confiáveis):** nome, id externo/sku, marca, descrição, imagens em alta, preço atual, disponibilidade, faixas de preço por quantidade (com id por tiragem), eixos de variação com ids reais, breadcrumb, extras (serviços), agregado de avaliações.

**Não encontrados no HTML estático (renderizados via JavaScript):** o **prazo de produção** ("2 dias úteis + frete") não está no HTML inicial — o parser tenta múltiplos padrões e, quando ausente, registra `warning` em vez de inventar. As **avaliações** existem no JSON-LD mas, por política (seções 18 e topo da spec), **não copiamos** textos/autores; usamos apenas média/contagem agregadas.

## 5. Seletores / endpoints utilizados

- JSON-LD: `<script ... application/ld+json>...</script>` (atributos sem aspas, HTML minificado).
- dataLayer: `dataLayer.push({"event":"view_item", ...})`.
- Tiragens: split por `<tr` filtrando `name=qtd-sku`; id via `trocarProduto('...',ID)`.
- Variações: `select[data-type]` + `title="Ver produto (no|na|com|em) <Eixo> <Valor>"` com `?id=`.
- Sem uso de endpoints XHR/JSON adicionais — tudo veio do HTML server-rendered.

## 6. Produtos que exigem JavaScript

Nenhum dos 6 testados exige navegador para os dados centrais. Apenas o **prazo de produção** é dinâmico. Caso futuramente alguma família dependa de XHR/JS para preço ou variação, a recomendação é um **worker backend com Playwright** (não no frontend, não na server function leve) — ver "Melhorias futuras".

## 7. Proteções de segurança (seção 4)

`src/services/urlValidator.ts` + `src/integrations/supabase/importer-actions.ts`:

- **HTTPS-only** (bloqueia `http`, `file://`, `ftp://`, `javascript:`, `data:`).
- **Allowlist** de domínios (`futuraim.com.br`, `www.futuraim.com.br`).
- **Bloqueio** de `localhost`, `*.local/.internal`, IPs literais, `127.*`, `10.*`, `192.168.*`, `169.254.*`, `172.16–31.*`, `::1`, `fc00:`, `fe80:`.
- **Timeout** (15s, `AbortController`) e **limite de tamanho** (4 MB).
- Apenas `Content-Type` HTML é aceito. UA identificável.

> Ressalva: a validação é por **host/allowlist**, não há resolução DNS + verificação de IP (DNS rebinding). Como a allowlist contém apenas FuturaIM, o risco é mínimo; resolução DNS pode ser adicionada se a allowlist crescer.

## 8. Classificação (seções 21–24)

`src/services/productClassifier.ts` com árvore de 10+ categorias e subcategorias, ordenadas do mais específico ao mais genérico (ex.: *Wind Banner* antes de *Banner*; *DTF UV* antes de *Adesivo*). Saída: categoria, subcategoria, confiança 0–100, motivo, tags, **segmentos** (nunca categoria) e **setor de produção/técnica** (nunca categoria). Confiança < 80 ⇒ `review_required`.

## 9. Deduplicação (seção 26)

`computeDedupKeys` gera chaves por: `supplier+external_id`, `supplier+url canônica`, `supplier+sku` e `hash` (FNV-1a) dos atributos principais. Pronto para o fluxo de upsert (ainda a ligar às novas tabelas — fase seguinte).

## 10. Banco de dados (seção 25)

Migration `supabase/migrations/20260628000000_product_importer_schema.sql` cria:
`product_import_jobs`, `product_import_items`, `product_variants`, `product_price_tiers`,
`product_attributes`, `product_attribute_values`, `product_images`, `product_templates`,
`product_extras`, `product_categories`, `product_segments`, `product_category_mappings`,
com RLS uniforme via `user_owns_company(company_id)` e índices de deduplicação.
Colunas novas em `products`: `subcategory`, `review_required`, `classification_confidence`.

> `suppliers`, `supplier_imports`, `supplier_mapping_rules` e `supplier_page_snapshots` já existiam (criadas via Studio; refletidas em `types.ts`) e foram reaproveitadas.

## 11. Remoção de dados fake

`src/lib/supplier-extractor.ts` **deixou de fabricar** faixas de preço simuladas quando a página não expõe tabela de tiragens. Agora `quantity_prices` fica vazio e o usuário completa na revisão. O caminho FuturaIM usa exclusivamente tiragens reais.

## 12. Testes (resultado)

`npm run test` → **34 testes, 100% passando** (vitest), incluindo parsing contra **6 páginas reais**:

- `productNormalizer.test.ts` (8) — preço BR/intl, mm, cores 4x4/5x0, material/gramatura, prazo.
- `productClassifier.test.ts` (8) — categorias, segmento ≠ categoria, DTF UV ≠ têxtil, revisão.
- `futuraImParser.test.ts` (6) — JSON-LD, dataLayer, tiragens reais, produto completo, banner.
- `futuraImRealPages.test.ts` (5) — 4 produtos reais + asserção DTF UV ≠ têxtil.
- `importerService.test.ts` (7) — anti-SSRF, tipo de página, lote, deduplicação.

**Build:** `npm run build` conclui com sucesso (chunks `importer-actions` e `futuraImParser` emitidos).

## 13. Classificações duvidosas

- "Caneca" também aciona a técnica *Sublimação* por heurística — correto para FuturaIM, mas revisar se surgirem canecas não-sublimadas.
- Produtos com nomes muito genéricos podem cair em `Não classificado` (confiança 0 ⇒ revisão). Comportamento desejado (nunca classifica em silêncio).

## 14. Limitações (escopo desta fase)

1. **Persistência completa nas novas tabelas** (variants/price_tiers/attributes/images/...) e o **fluxo de upsert com as chaves de dedup** ainda não foram ligados — a fase atual entrega os builders e as migrations; a gravação atual reaproveita a tabela `products` existente.
2. **Tela dedicada `/produtos/importar`** com lote/catálogo/fila/progresso ainda não criada — a integração foi feita no importador existente (modal "Importar via Link"), agora usando o caminho seguro FuturaIM.
3. **Modo catálogo / fila / Playwright / storage de imagens / atualização de preços** (seções 27, 30, 17-storage): não implementados nesta fase.
4. **Não foi possível testar, neste ambiente, persistência/dedup/atualização contra um Supabase ao vivo** (sem credenciais/instância). Os testes cobrem parsing/normalização/classificação/validação com dados reais; a persistência foi validada por tipos/build, não por execução em banco.
5. Prazo de produção depende de JS na FuturaIM (ver §6).

## 14b. Tela dedicada e fila persistente (fases 2 e 3 — entregues)

**Tela `/produtos/importar`** (`src/routes/_app/produtos.importar.tsx` + `src/components/products/importador-produtos.tsx`): 3 modos (individual, lote, catálogo), opções (atualizar existentes, imagens, tabelas de preço, gabaritos, descrição, descrição só interna, fornecedor externo), margem, barra de progresso, painéis de erros/avisos, prévia editável (nome/categoria/subcategoria) com tiragens/variações/extras, aprovação manual e aba **Histórico**. Botão "Importar por link" no cabeçalho de Produtos aponta para a rota.

**Paginação de catálogo** (`discoverCatalogLinks`): BFS limitado (máx. 25 páginas, intervalo 600ms) que segue `rel=next`/anchors `?pagina=|page=|p=` e **para quando não surgem links novos**. Verificado: a FuturaIM é **página única** (todos-os-produtos = 492 produtos num fetch; `?pagina=2` retorna os mesmos links), então uma requisição já traz tudo; a lógica de seguir páginas cobre catálogos paginados de outros sites.

**Fila persistente + retomada** (seção 30) — `src/lib/importer-jobs.ts` + tabelas `product_import_jobs`/`product_import_items`:
- Ao importar um catálogo, cria-se um **job** e um **item por link** (deduplicados por id externo) no banco.
- Processamento sequencial com intervalo; cada item grava status + `normalized_data` (o produto estruturado) no banco.
- Recarregar a página mostra um banner **"Importações em andamento → Retomar"**; a retomada recarrega os itens, re-hidrata as prévias e processa **apenas os pendentes** (não reprocessa o que já foi feito).
- Contadores do job (`total_processed/success/error`) são sincronizados; ao salvar, o item recebe `product_id` e o job é finalizado.
- Tudo **tolerante a falha**: se a persistência falhar (RLS/tabela ausente), o fluxo segue em memória.

> Acesso às novas tabelas é feito por handle sem tipagem estrita (`supabase as any`) porque `types.ts` ainda não foi regenerado (precisa de DB ao vivo). `npx tsc --noEmit` = **0 erros**; `npm run build` OK; **34 testes** passam.

## 14c. Gravação no grafo estruturado (entregue)

Além de `products`, o salvamento agora grava o **grafo estruturado** (seção 25):
- `src/services/structuredMappers.ts` — **mapeadores puros** (testados) que convertem o produto em linhas de `product_variants`, `product_price_tiers`, `product_attributes`/`product_attribute_values`, `product_images`, `product_templates`, `product_extras`. Atributos de specs e eixos de variação são **fundidos sem duplicar** (valores deduplicados; opções carregam o id externo real).
- `src/lib/importer-structured-persistence.ts` — **writer idempotente**: ao reimportar, remove os filhos (cascatas cuidam de tiers/values) e regrava (re-sync, sem duplicar). Cria/reaproveita `product_categories` (categoria + subcategoria como filha), `product_segments` e grava `product_category_mappings` (uma linha por segmento, com confiança e motivo). Cada seção é isolada e **tolerante a falha**: acumula avisos sem derrubar o salvamento em `products`.
- Integrado em `persistImportedProduct` (flag `writeStructured`, padrão on). A tela mostra um toast de aviso quando há falhas parciais na gravação estruturada.
- Testes: `structuredMappers.test.ts` valida material/formato/cor separados, tiragens reais com id por faixa, fusão de atributos sem duplicar, 1 imagem principal e extras reais. **39 testes** no total; `tsc --noEmit` = 0 erros; build OK.

## 14d. Atualizar preços do fornecedor (entregue)

Aba **"Atualizar preços"** em `/produtos/importar` (`src/components/products/atualizar-precos.tsx`):
- Lista os produtos importados (`origin=supplier_import` com `source_url`).
- **Verificar preços**: reabre cada link original (server-side, anti-SSRF, em fila com intervalo) e compara as tiragens.
- Mostra por produto: custo atual × custo novo, variação %, status (**alterado / igual / indisponível / erro**) e detalhamento por faixa (**alteradas / novas / removidas**).
- **Aplicar custo** (por item ou em massa "todos alterados"): atualiza **somente o custo** (`cost_price`, `base_cost`, custo das faixas) e re-sincroniza o grafo estruturado. **Preserva o preço de venda e a margem** (seção 27) — faixas existentes mantêm o `sellPrice`; faixas novas recebem apenas uma sugestão de venda via margem. Registra histórico (`supplier_imports`, status `price_updated`).
- Lógica de comparação isolada e pura em `src/services/priceComparison.ts` (testada: alterada/nova/removida/indisponível/epsilon de centavos).

Custo do fornecedor, preço de venda e margem permanecem **separados**; o preço de venda nunca é sobrescrito automaticamente. **44 testes** no total; `tsc --noEmit` = 0; build OK.

## 14e. Storage de imagens + varredura completa de variantes (entregue)

**Varredura completa de variantes** (seção 10):
- `src/services/variantScan.ts` (puro, testado): `collectVariantUrls` (ids reais a visitar, exceto o atual) e `consolidateVariants` (funde N produtos num produto-base com todas as variantes reais, eixos unidos, `variant_scan_status='complete'`).
- Server fn `scanProductVariants` (`importer-actions.ts`): BFS limitado (máx. 40 variantes, intervalo 600ms) seguindo cada `?id=` real dos eixos — **nunca cartesiano**, só combinações que existem.
- Opção "Varredura completa de variantes" na tela; quando ligada, a análise usa `scanProductVariants` e o salvamento grava todas as variantes (cada uma com suas tiragens) no grafo estruturado.

**Storage de imagens** (seção 17):
- Migration `20260628010000_imported_products_storage.sql`: bucket público `imported-products` + políticas de escrita por empresa (`{company_id}/imported-products/{product_id}/...`, via `user_owns_company`).
- Server fn `fetchImageBytes` (allowlist do CDN `wbl.blob.core.windows.net` + FuturaIM, HTTPS, timeout, limite 8MB) baixa os bytes server-side.
- `src/lib/importer-image-storage.ts`: `copyImagesToStorage` envia ao bucket e devolve URLs públicas (best-effort; mantém a externa em caso de falha).
- Opção "Copiar imagens para o Storage" na tela; integrada em `persistImportedProduct` (copia antes do grafo estruturado e atualiza `products.image_url`/`gallery_images`). Padrão **desligado** (mantém URL externa, que já funciona).

**46 testes** (2 novos de varredura); `tsc --noEmit` = 0; build OK.

## 15. Melhorias futuras

- Ligar `buildProductRow` + novas tabelas (variants/tiers/images/extras) com upsert por `computeDedupKeys`.
- Criar rota `/produtos/importar` (modos individual/lote/catálogo, prévia rica, progresso, erros/avisos).
- Worker Playwright para prazo de produção e eventuais famílias JS.
- Cópia opcional de imagens para Supabase Storage (`company_id/imported-products/product_id/`).
- Modo "Atualizar preços do fornecedor" com histórico e comparação de tiragens.
- Varredura completa de variantes (seguir os `?id=` reais de cada eixo) respeitando intervalos/limites.
