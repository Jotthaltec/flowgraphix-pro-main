import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseFuturaImProduct } from "@/services/futuraImParser";
import { collectVariantUrls, consolidateVariants } from "@/services/variantScan";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = (n: string) => readFileSync(join(__dirname, "fixtures", n), "utf8");

describe("variantScan", () => {
  it("collectVariantUrls retorna ids de combinação diferentes do atual", () => {
    const p = parseFuturaImProduct(
      fx("futuraim-cartao-de-visita.html"),
      "https://www.futuraim.com.br/produto/cartao-de-visita-em-couche-fosco-com-laminacao-fosca-e-verniz-localizado?id=4627",
    );
    const urls = collectVariantUrls(p);
    expect(urls.length).toBeGreaterThan(0);
    // nenhum aponta para o próprio id 4627
    expect(urls.every((u) => !/id=4627(\b|&|$)/.test(u))).toBe(true);
    // todos têm um id externo
    expect(urls.every((u) => /\?id=\d+/.test(u))).toBe(true);
  });

  it("consolidateVariants junta variantes reais e marca scan completo", () => {
    const a = parseFuturaImProduct(fx("futuraim-cartao-de-visita.html"), "https://www.futuraim.com.br/produto/cartao?id=4627");
    const b = parseFuturaImProduct(fx("futuraim-adesivo-vinil.html"), "https://www.futuraim.com.br/produto/adesivo-em-vinil?id=11867");
    const merged = consolidateVariants([a, b]);
    expect(merged.variant_scan_status).toBe("complete");
    const ids = merged.variants.map((v) => v.external_id);
    expect(ids).toContain("4627");
    expect(ids).toContain("11867");
    // base = primeiro produto
    expect(merged.original_name).toBe(a.original_name);
    // aviso de "pendentes" removido e aviso de varredura completa presente
    expect(merged.warnings.some((w) => /varredura completa/i.test(w))).toBe(true);
  });
});
