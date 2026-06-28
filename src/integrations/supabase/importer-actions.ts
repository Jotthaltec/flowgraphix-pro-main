import { createServerFn } from "@tanstack/react-start";
import { parseFuturaImProduct } from "@/services/futuraImParser";
import { validateSupplierUrl } from "@/services/urlValidator";
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
