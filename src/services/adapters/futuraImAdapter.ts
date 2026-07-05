/**
 * Adaptador ESPECÍFICO da FuturaIM.
 *
 * Não reimplementa nada: envolve o parser dedicado já existente e testado
 * (`parseFuturaImProduct`). Serve de referência de como um fornecedor com
 * modelo próprio (tabela de tiragens, eixos com `?id=`, dataLayer) se encaixa
 * no contrato universal.
 */

import type { ImportedProduct } from "@/types/importedProduct";
import { FUTURAIM_DOMAINS, parseFuturaImProduct } from "@/services/futuraImParser";
import type { AdapterMatchContext, SupplierAdapter } from "./types";

const domainSet = new Set(FUTURAIM_DOMAINS.map((d) => d.replace(/^www\./, "")));

export const FuturaImAdapter: SupplierAdapter = {
  key: "futuraim",
  label: "FuturaIM",
  domains: FUTURAIM_DOMAINS,

  matchScore(ctx: AdapterMatchContext) {
    const domain = ctx.domain.replace(/^www\./, "");
    if (domainSet.has(domain)) {
      return { score: 1, reason: "domínio FuturaIM (adaptador dedicado)" };
    }
    return { score: 0, reason: "domínio não é FuturaIM" };
  },

  parseProduct(html: string, url: string): ImportedProduct {
    return parseFuturaImProduct(html, url);
  },
};
