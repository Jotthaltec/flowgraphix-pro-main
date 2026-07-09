import { createServerFn } from "@tanstack/react-start";
import { parseFuturaImProduct, externalIdFromUrl } from "@/services/futuraImParser";
import { collectVariantUrls, consolidateVariants } from "@/services/variantScan";
import { validateSupplierUrl } from "@/services/urlValidator";
import {
  buildFreightPath,
  extractAntiForgeryToken,
  isValidCep,
  parseFuturaImFreight,
  type FreightOption,
} from "@/services/futuraImFreight";
import {
  extractProductFormFields,
  parseLivePriceFragment,
  supportsCustomSize,
  type LivePriceResult,
} from "@/services/futuraImLivePrice";
import type { ImportedProduct } from "@/types/importedProduct";

/**
 * Backend seguro do IMPORTADOR DE PRODUTOS POR LINK (seção 4 da spec).
 *
 * Toda a raspagem acontece SERVER-SIDE (server function do TanStack Start).
 * O frontend nunca faz fetch direto na FuturaIM — assim não expomos cookies,
 * chaves ou lógica de importação, e aplicamos proteção contra SSRF.
 *
 * Proteções:
 *  - Apenas HTTPS.
 *  - Allowlist de domínios (inicialmente apenas FuturaIM).
 *  - Bloqueio de localhost, IPs literais e redes privadas/internas.
 *  - Timeout por AbortController.
 *  - Limite de tamanho do corpo da resposta.
 *  - User-Agent identificável e leitura apenas de HTML.
 */

const FETCH_TIMEOUT_MS = 15000;
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Busca o HTML de uma página de fornecedor de forma segura (server-side).
 */
export const fetchSupplierPage = createServerFn({ method: "POST" })
  .inputValidator((data: { url: string }) => data)
  .handler(async ({ data }) => {
    const validation = validateSupplierUrl(data?.url);
    if (!validation.ok || !validation.url) {
      return { success: false, error: validation.reason || "URL não permitida." };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(validation.url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "PrintFlowCRM-Importer/1.0 (+contato via painel)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9",
        },
      });

      if (!response.ok) {
        return { success: false, error: `Falha ao acessar a página (HTTP ${response.status}).` };
      }

      const contentType = response.headers.get("content-type") || "";
      if (!/text\/html|application\/xhtml/i.test(contentType)) {
        return { success: false, error: `Conteúdo não é HTML (${contentType || "desconhecido"}).` };
      }

      const lengthHeader = Number(response.headers.get("content-length") || 0);
      if (lengthHeader && lengthHeader > MAX_BYTES) {
        return { success: false, error: "Página excede o tamanho máximo permitido." };
      }

      // Leitura com corte de tamanho (defende contra Content-Length ausente).
      const buf = await response.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) {
        return { success: false, error: "Página excede o tamanho máximo permitido." };
      }
      const html = new TextDecoder("utf-8").decode(buf);

      return {
        success: true,
        html,
        domain: validation.domain,
        fetched_at: new Date().toISOString(),
      };
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return { success: false, error: "Tempo limite excedido ao acessar a página." };
      }
      return { success: false, error: err?.message || "Erro ao buscar a página." };
    } finally {
      clearTimeout(timeout);
    }
  });

/**
 * Analisa um link da FuturaIM ponta-a-ponta no servidor: valida a URL,
 * busca o HTML com proteção anti-SSRF e devolve o produto já estruturado,
 * normalizado e classificado. A lógica de parsing fica no servidor.
 */
export const analyzeSupplierLink = createServerFn({ method: "POST" })
  .inputValidator((data: { url: string }) => data)
  .handler(async ({ data }): Promise<{ success: true; product: ImportedProduct } | { success: false; error: string }> => {
    const validation = validateSupplierUrl(data?.url);
    if (!validation.ok || !validation.url) {
      return { success: false, error: validation.reason || "URL não permitida." };
    }

    const page = await fetchSupplierPage({ data: { url: validation.url } });
    if (!page.success || !page.html) {
      return { success: false, error: page.error || "Não foi possível obter a página." };
    }

    try {
      const product = parseFuturaImProduct(page.html, validation.url);
      return { success: true, product };
    } catch (err: any) {
      return { success: false, error: `Erro ao interpretar a página: ${err?.message || err}` };
    }
  });

// Hosts permitidos para baixar imagens de produto (CDN da FuturaIM).
const IMAGE_ALLOWED_HOSTS = ["wbl.blob.core.windows.net", "futuraim.com.br", "www.futuraim.com.br"];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Baixa os bytes de uma imagem de produto de forma segura (server-side) para
 * cópia ao Supabase Storage (seção 17). Allowlist de hosts de imagem, HTTPS,
 * timeout e limite de tamanho. Retorna base64 + content-type.
 */
export const fetchImageBytes = createServerFn({ method: "POST" })
  .inputValidator((data: { url: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{ success: true; base64: string; contentType: string } | { success: false; error: string }> => {
      let parsed: URL;
      try {
        parsed = new URL((data?.url || "").trim());
      } catch {
        return { success: false, error: "URL de imagem inválida." };
      }
      if (parsed.protocol !== "https:") return { success: false, error: "Imagem deve ser HTTPS." };
      const host = parsed.hostname.toLowerCase();
      if (!IMAGE_ALLOWED_HOSTS.includes(host)) {
        return { success: false, error: `Host de imagem não permitido: ${host}.` };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const resp = await fetch(parsed.toString(), { signal: controller.signal });
        if (!resp.ok) return { success: false, error: `HTTP ${resp.status} ao baixar imagem.` };
        const contentType = resp.headers.get("content-type") || "application/octet-stream";
        if (!/^image\//i.test(contentType)) return { success: false, error: `Conteúdo não é imagem (${contentType}).` };
        const buf = await resp.arrayBuffer();
        if (buf.byteLength > MAX_IMAGE_BYTES) return { success: false, error: "Imagem excede o tamanho máximo." };
        // Converte para base64 sem depender de Buffer (portável).
        let binary = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        return { success: true, base64, contentType };
      } catch (err: any) {
        if (err?.name === "AbortError") return { success: false, error: "Timeout ao baixar imagem." };
        return { success: false, error: err?.message || "Erro ao baixar imagem." };
      } finally {
        clearTimeout(timeout);
      }
    },
  );

const VARIANT_SCAN_MAX = 150; // cobre matrizes grandes (material × formato × impressão)
const VARIANT_SCAN_DELAY_MS = 500;

/**
 * Varredura completa de variantes (seção 10): segue, em largura, cada `?id=`
 * real apontado pelos eixos de variação, coletando apenas combinações que de
 * fato existem (nunca produto cartesiano). Limitado em nº de variantes e com
 * intervalo entre requisições (raspagem responsável).
 */
export const scanProductVariants = createServerFn({ method: "POST" })
  .inputValidator((data: { url: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{ success: true; product: ImportedProduct; scanned: number } | { success: false; error: string }> => {
      const validation = validateSupplierUrl(data?.url);
      if (!validation.ok || !validation.url) {
        return { success: false, error: validation.reason || "URL não permitida." };
      }

      const collected: ImportedProduct[] = [];
      const visited = new Set<string>();
      const toVisit: string[] = [validation.url];

      while (toVisit.length && collected.length < VARIANT_SCAN_MAX) {
        const current = toVisit.shift()!;
        const v = validateSupplierUrl(current);
        if (!v.ok || !v.url) continue;
        const id = externalIdFromUrl(v.url) || v.url;
        if (visited.has(id)) continue;
        visited.add(id);

        const page = await fetchSupplierPage({ data: { url: v.url } });
        if (!page.success || !page.html) continue;

        let product: ImportedProduct;
        try {
          product = parseFuturaImProduct(page.html, v.url);
        } catch {
          continue;
        }
        collected.push(product);

        for (const next of collectVariantUrls(product)) {
          const nid = externalIdFromUrl(next);
          if (nid && !visited.has(nid)) toVisit.push(next);
        }

        if (toVisit.length && collected.length < VARIANT_SCAN_MAX) await sleep(VARIANT_SCAN_DELAY_MS);
      }

      if (!collected.length) {
        return { success: false, error: "Nenhuma variante pôde ser coletada." };
      }

      const product = consolidateVariants(collected);
      return { success: true, product, scanned: collected.length };
    },
  );

/**
 * Cotação de FRETE REAL do fornecedor (seção 11).
 *
 * A FuturaIM exige, além dos parâmetros, o par (cookie antiforgery + token) que
 * só existe depois de carregar a página do produto. Por isso a cotação é feita
 * em dois passos, sempre server-side:
 *
 *   1. GET da página do produto  → captura `Set-Cookie` e o `__RequestVerificationToken`;
 *   2. POST /produtos/frete-sku/?cep=&produtoId=&quantidade=  com cookie + token.
 *
 * Nunca inventa frete: se o fornecedor não cotar, devolve `options: []` e o
 * chamador trata como "frete não cotado" (o orçamento não assume custo zero).
 */
export const getSupplierFreight = createServerFn({ method: "POST" })
  .inputValidator((data: { url: string; cep: string; quantidade: number }) => data)
  .handler(
    async ({
      data,
    }): Promise<
      | { success: true; options: FreightOption[]; produto_id: string; cep: string; quoted_at: string }
      | { success: false; error: string }
    > => {
      const validation = validateSupplierUrl(data?.url);
      if (!validation.ok || !validation.url) {
        return { success: false, error: validation.reason || "URL não permitida." };
      }
      if (!isValidCep(data?.cep)) {
        return { success: false, error: "CEP inválido — informe 8 dígitos." };
      }
      const produtoId = externalIdFromUrl(validation.url);
      if (!produtoId) {
        return { success: false, error: "Não foi possível identificar o produto (?id=) na URL." };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const origin = new URL(validation.url).origin;

      try {
        // 1. Página do produto: cookie antiforgery + token.
        const pageRes = await fetch(validation.url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: {
            "User-Agent": "PrintFlowCRM-Importer/1.0 (+contato via painel)",
            Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9",
          },
        });
        if (!pageRes.ok) {
          return { success: false, error: `Falha ao abrir a página do produto (HTTP ${pageRes.status}).` };
        }

        // `getSetCookie` preserva múltiplos Set-Cookie; fallback para o header simples.
        const rawCookies: string[] =
          typeof (pageRes.headers as any).getSetCookie === "function"
            ? (pageRes.headers as any).getSetCookie()
            : [pageRes.headers.get("set-cookie") || ""].filter(Boolean);
        const cookieHeader = rawCookies.map((c) => c.split(";")[0]).filter(Boolean).join("; ");

        const html = await pageRes.text();
        const token = extractAntiForgeryToken(html);
        if (!token) {
          return { success: false, error: "Token de segurança do fornecedor não encontrado na página." };
        }

        // 2. Cotação do frete.
        const freightUrl = origin + buildFreightPath(data.cep, produtoId, data.quantidade);
        const freightRes = await fetch(freightUrl, {
          method: "POST",
          redirect: "manual", // 302 => rejeição (token/cookie inválidos)
          signal: controller.signal,
          headers: {
            "User-Agent": "PrintFlowCRM-Importer/1.0 (+contato via painel)",
            Accept: "text/html,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9",
            "X-Requested-With": "XMLHttpRequest",
            RequestVerificationToken: token,
            Referer: validation.url,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
        });

        if (freightRes.status !== 200) {
          return {
            success: false,
            error: `Fornecedor não cotou o frete (HTTP ${freightRes.status}).`,
          };
        }

        const buf = await freightRes.arrayBuffer();
        if (buf.byteLength > MAX_BYTES) {
          return { success: false, error: "Resposta de frete excede o tamanho permitido." };
        }
        const fragment = new TextDecoder("utf-8").decode(buf);

        return {
          success: true,
          options: parseFuturaImFreight(fragment),
          produto_id: produtoId,
          cep: data.cep.replace(/\D/g, ""),
          quoted_at: new Date().toISOString(),
        };
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return { success: false, error: "Tempo limite excedido ao cotar o frete." };
        }
        return { success: false, error: err?.message || "Erro ao cotar o frete." };
      } finally {
        clearTimeout(timeout);
      }
    },
  );

const CATALOG_MAX_PAGES = 25;
const CATALOG_PAGE_DELAY_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Extrai links de produto de um HTML, normalizados com o origin. */
function extractProductLinks(html: string, origin: string): string[] {
  const found = new Set<string>();
  const re = /\/produto\/[a-z0-9\-]+\?id=\d+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) found.add(origin + m[0]);
  return [...found];
}

/** Encontra URLs de "próxima página" (rel=next ou anchors com pagina=/page=). */
function extractPaginationLinks(html: string, origin: string): string[] {
  const out = new Set<string>();
  // rel=next
  const relNext = html.match(/<(?:a|link)[^>]*rel=["']?next["']?[^>]*href=["']([^"']+)["']/i);
  if (relNext) out.add(relNext[1]);
  // anchors numerados de paginação
  const re = /href=["']([^"']*(?:[?&](?:pagina|page|p)=\d+)[^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.add(m[1]);
  // normaliza para absoluto
  return [...out].map((h) => (h.startsWith("http") ? h : origin + (h.startsWith("/") ? h : `/${h}`)));
}

/**
 * Descobre os links de produto de uma página de catálogo/categoria (modo 3),
 * seguindo a paginação quando existir (BFS limitado e com intervalo). Para
 * sites de página única (FuturaIM), uma só requisição já traz tudo. Para de
 * paginar quando não surgem novos links, ao atingir o limite de páginas ou
 * quando não há próxima página. Valida cada URL (allowlist/anti-SSRF).
 */
export const discoverCatalogLinks = createServerFn({ method: "POST" })
  .inputValidator((data: { url: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{ success: true; links: string[]; pages_crawled: number } | { success: false; error: string }> => {
      const validation = validateSupplierUrl(data?.url);
      if (!validation.ok || !validation.url) {
        return { success: false, error: validation.reason || "URL não permitida." };
      }

      const origin = `https://${validation.domain === "futuraim.com.br" ? "www.futuraim.com.br" : validation.domain}`;
      const products = new Set<string>();
      const visited = new Set<string>();
      const toVisit: string[] = [validation.url];
      let pagesCrawled = 0;
      let firstError: string | undefined;

      while (toVisit.length && pagesCrawled < CATALOG_MAX_PAGES) {
        const current = toVisit.shift()!;
        if (visited.has(current)) continue;
        const v = validateSupplierUrl(current);
        if (!v.ok || !v.url) continue;
        visited.add(current);

        const page = await fetchSupplierPage({ data: { url: v.url } });
        pagesCrawled++;
        if (!page.success || !page.html) {
          if (!firstError) firstError = page.error;
          continue;
        }

        const before = products.size;
        for (const link of extractProductLinks(page.html, origin)) products.add(link);
        const gainedNew = products.size > before;

        // Só continua paginando se esta página agregou produtos novos.
        if (gainedNew) {
          for (const next of extractPaginationLinks(page.html, origin)) {
            if (!visited.has(next)) toVisit.push(next);
          }
        }

        if (toVisit.length) await sleep(CATALOG_PAGE_DELAY_MS);
      }

      if (products.size === 0) {
        return { success: false, error: firstError || "Nenhum link de produto encontrado nesta página." };
      }
      return { success: true, links: [...products], pages_crawled: pagesCrawled };
    },
  );

/**
 * LIVE_RESOLVER — consulta o preço REAL de um produto de tamanho personalizado (§8).
 *
 * Medido contra o site: o preço NÃO é área × preço/m². Há preço mínimo, limites
 * de largura/altura e faixas por quantidade. Por isso nunca calculamos: perguntamos.
 *
 * Dois passos (server-side, respeitando a allowlist anti-SSRF):
 *   1. GET da página do produto → cookie antiforgery + token + campos do #formProduto;
 *   2. POST na mesma URL com o formulário (Largura/Altura/Quantidade) → fragmento
 *      `#produtoGeral`, de onde lemos o "Total".
 *
 * Total 0,00 = dimensão fora dos limites → `has_price=false`, jamais "grátis".
 */
export const resolveLivePrice = createServerFn({ method: "POST" })
  .inputValidator((data: { url: string; largura: number; altura: number; quantidade: number }) => data)
  .handler(
    async ({
      data,
    }): Promise<
      | { success: true; result: LivePriceResult; supports_custom_size: boolean; quoted_at: string }
      | { success: false; error: string }
    > => {
      const validation = validateSupplierUrl(data?.url);
      if (!validation.ok || !validation.url) {
        return { success: false, error: validation.reason || "URL não permitida." };
      }
      const largura = Number(data?.largura);
      const altura = Number(data?.altura);
      const quantidade = Number(data?.quantidade);
      if (!Number.isFinite(largura) || largura <= 0 || !Number.isFinite(altura) || altura <= 0) {
        return { success: false, error: "Informe largura e altura válidas (maiores que zero)." };
      }
      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        return { success: false, error: "Informe uma quantidade válida." };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const commonHeaders = {
        "User-Agent": "PrintFlowCRM-Importer/1.0 (+contato via painel)",
        "Accept-Language": "pt-BR,pt;q=0.9",
      };

      try {
        // 1. Página do produto: cookie, token e o formulário original.
        const pageRes = await fetch(validation.url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: { ...commonHeaders, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8" },
        });
        if (!pageRes.ok) {
          return { success: false, error: `Falha ao abrir a página do produto (HTTP ${pageRes.status}).` };
        }

        const rawCookies: string[] =
          typeof (pageRes.headers as any).getSetCookie === "function"
            ? (pageRes.headers as any).getSetCookie()
            : [pageRes.headers.get("set-cookie") || ""].filter(Boolean);
        const cookieHeader = rawCookies.map((c) => c.split(";")[0]).filter(Boolean).join("; ");

        const html = await pageRes.text();
        const token = extractAntiForgeryToken(html);
        if (!token) {
          return { success: false, error: "Token de segurança do fornecedor não encontrado na página." };
        }
        const custom = supportsCustomSize(html);

        // 2. Reposta o formulário completo, sobrescrevendo dimensões e quantidade.
        const fields = extractProductFormFields(html);
        const body = new URLSearchParams({
          ...fields,
          Largura: String(Math.trunc(largura)),
          Altura: String(Math.trunc(altura)),
          Quantidade: String(Math.trunc(quantidade)),
          __RequestVerificationToken: token,
        });

        const priceRes = await fetch(validation.url, {
          method: "POST",
          redirect: "manual", // 302 => token/cookie rejeitados
          signal: controller.signal,
          headers: {
            ...commonHeaders,
            Accept: "text/html,*/*;q=0.8",
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Requested-With": "XMLHttpRequest",
            RequestVerificationToken: token,
            Referer: validation.url,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body: body.toString(),
        });

        if (priceRes.status !== 200) {
          return { success: false, error: `Fornecedor não retornou o preço (HTTP ${priceRes.status}).` };
        }

        const buf = await priceRes.arrayBuffer();
        if (buf.byteLength > MAX_BYTES) {
          return { success: false, error: "Resposta de preço excede o tamanho permitido." };
        }
        const fragment = new TextDecoder("utf-8").decode(buf);

        const result = parseLivePriceFragment(fragment);
        if (!result) {
          return { success: false, error: "Não foi possível ler o preço na resposta do fornecedor." };
        }

        return {
          success: true,
          result,
          supports_custom_size: custom,
          quoted_at: new Date().toISOString(),
        };
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return { success: false, error: "Tempo limite excedido ao consultar o preço." };
        }
        return { success: false, error: err?.message || "Erro ao consultar o preço." };
      } finally {
        clearTimeout(timeout);
      }
    },
  );
