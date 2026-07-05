import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseFuturaImProduct } from "@/services/futuraImParser";
import { collectVariantUrls, consolidateVariants, attachVariantPrices } from "@/services/variantScan";
import type { ImportedProduct } from "@/types/importedProduct";

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

  it("attachVariantPrices anexa o custo real de cada combinação às opções do eixo", () => {
    const base = parseFuturaImProduct(
      fx("futuraim-cartao-de-visita.html"),
      "https://www.futuraim.com.br/produto/cartao-de-visita?id=20145",
    );
    const formato = base.variant_axes.find((a) => a.normalized_name === "formato")!;
    // Simula a varredura: variantes com external_id = id de 2 opções de Formato,
    // cada uma com sua própria tiragem (custo distinto).
    const opts = formato.options.filter((o) => o.external_id).slice(0, 2);
    const fakeVariants: ImportedProduct["variants"] = opts.map((o, i) => ({
      external_id: o.external_id,
      sku: o.external_id,
      title: `t${i}`,
      attributes: [],
      available: true,
      price_tiers: [
        { quantity: 100, unit: "unidade", total_price: 100 + i * 20, unit_price: (100 + i * 20) / 100, currency: "BRL", collected_at: "x" },
      ],
      raw_attributes: {},
    }));
    const enriched = attachVariantPrices({ ...base, variants: [...base.variants, ...fakeVariants] });
    const eFormato = enriched.variant_axes.find((a) => a.normalized_name === "formato")!;
    const enrichedOpts = eFormato.options.filter((o) => opts.some((x) => x.external_id === o.external_id));
    // Cada opção varrida recebeu SEU custo (0.—) e a quantidade de referência.
    expect(enrichedOpts.every((o) => typeof o.unit_price === "number" && o.unit_price! > 0)).toBe(true);
    expect(enrichedOpts.map((o) => o.unit_price)).toEqual([1, 1.2]);
    expect(enrichedOpts.every((o) => o.ref_quantity === 100)).toBe(true);
    // Nada é fabricado: sem variantes coletadas, opções ficam sem preço.
    const untouched = attachVariantPrices({ ...base, variants: [] });
    expect(untouched.variant_axes.every((a) => a.options.every((o) => o.unit_price === undefined))).toBe(true);
  });
});
