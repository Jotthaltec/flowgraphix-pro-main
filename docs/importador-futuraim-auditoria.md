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

## 15. Melhorias futuras

- Ligar `buildProductRow` + novas tabelas (variants/tiers/images/extras) com upsert por `computeDedupKeys`.
- Criar rota `/produtos/importar` (modos individual/lote/catálogo, prévia rica, progresso, erros/avisos).
- Worker Playwright para prazo de produção e eventuais famílias JS.
- Cópia opcional de imagens para Supabase Storage (`company_id/imported-products/product_id/`).
- Modo "Atualizar preços do fornecedor" com histórico e comparação de tiragens.
- Varredura completa de variantes (seguir os `?id=` reais de cada eixo) respeitando intervalos/limites.
