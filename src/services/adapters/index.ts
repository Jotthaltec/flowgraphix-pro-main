/**
 * Ponto de entrada da camada de adaptadores do Motor Universal de Fornecedores.
 *
 * Registra os adaptadores nativos e expõe `parseWithAdapter`, que resolve o
 * melhor adaptador para a página e devolve o `ImportedProduct` + qual adaptador
 * foi usado e com que confiança (para gravar em supplier_products/crawl_runs).
 */

import type { ImportedProduct } from "@/types/importedProduct";
import { registerAdapter, resolveAdapter } from "./registry";
import { FuturaImAdapter } from "./futuraImAdapter";
import { GenericJsonLdAdapter } from "./genericJsonLdAdapter";
import type { AdapterMatchContext } from "./types";

// Registro dos adaptadores nativos (ordem não importa — resolução é por score).
registerAdapter(FuturaImAdapter);
registerAdapter(GenericJsonLdAdapter);

export * from "./types";
export {
  registerAdapter,
  unregisterAdapter,
  getAdapters,
  getAdapter,
  rankAdapters,
  resolveAdapter,
} from "./registry";
export { FuturaImAdapter } from "./futuraImAdapter";
export { GenericJsonLdAdapter } from "./genericJsonLdAdapter";

export interface ParseWithAdapterResult {
  product: ImportedProduct | null;
  adapterKey: string | null;
  confidence: number; // 0..1 do matchScore
  reason: string;
}

/**
 * Resolve o adaptador para a página e faz o parse. `preferKey` reutiliza o
 * adaptador do perfil aprovado do fornecedor (§5 — não reaprende a cada sync).
 */
export function parseWithAdapter(
  html: string,
  url: string,
  opts?: { domain?: string; preferKey?: string },
): ParseWithAdapterResult {
  const domain =
    opts?.domain ?? (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    })();

  const ctx: AdapterMatchContext = { url, domain, html };
  const match = resolveAdapter(ctx, opts?.preferKey);
  if (!match) {
    return { product: null, adapterKey: null, confidence: 0, reason: "nenhum adaptador aplicável" };
  }
  const product = match.adapter.parseProduct(html, url);
  return {
    product,
    adapterKey: match.adapter.key,
    confidence: match.score,
    reason: match.reason,
  };
}
