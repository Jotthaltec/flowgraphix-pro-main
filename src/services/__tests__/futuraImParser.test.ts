import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseFuturaImProduct,
  extractJsonLd,
  extractDataLayerItem,
  extractPriceTiers,
  externalIdFromUrl,
} from "@/services/futuraImParser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");

const CARTAO_URL =
  "https://www.futuraim.com.br/produto/cartao-de-visita-em-couche-fosco-com-laminacao-fosca-e-verniz-localizado?id=4627";

describe("futuraImParser (HTML real da FuturaIM)", () => {
  let html: string;
  beforeAll(() => {
    html = fixture("futuraim-cartao-de-visita.html");
  });

  it("extrai JSON-LD de Produto e de Serviços", () => {
    const ld = extractJsonLd(html);
    const product = ld.find((o) => String(o["@type"]).includes("Product"));
    expect(product).toBeTruthy();
    expect(product.sku).toBe(4627);
    const services = ld.filter((o) => String(o["@type"]).includes("Service"));
    expect(services.length).toBeGreaterThanOrEqual(1);
  });

  it("lê o estado embutido (dataLayer view_item)", () => {
    const dl = extractDataLayerItem(html);
    expect(dl?.ecommerce?.value).toBe(110.99);
    expect(dl?.ecommerce?.items?.[0]?.item_id).toBe("4627");
  });

  it("externalIdFromUrl pega o ?id=", () => {
    expect(externalIdFromUrl(CARTAO_URL)).toBe("4627");
  });

  it("extrai faixas de preço reais (sem fabricar)", () => {
    const tiers = extractPriceTiers(html, new Date().toISOString());
    const quantities = tiers.map((t) => t.quantity);
    // Tabela real: 100, 500, 1000, 5000, 10000, 20000
    expect(quantities).toContain(100);
    expect(quantities).toContain(500);
    expect(quantities).toContain(5000);
    const t100 = tiers.find((t) => t.quantity === 100);
    expect(t100?.total_price).toBe(88.99);
    // cada tiragem tem um id externo real
    expect(tiers.some((t) => !!t.external_id)).toBe(true);
  });

  it("produz produto estruturado completo e classificado", () => {
    const p = parseFuturaImProduct(html, CARTAO_URL);

    expect(p.supplier).toBe("FuturaIM");
    expect(p.external_id).toBe("4627");
    expect(p.original_name).toContain("Cartão de Visita");
    expect(p.brand).toBe("FuturaIM");

    // Classificação correta — segmento não vira categoria
    expect(p.classification.category).toBe("Impressos Promocionais");
    expect(p.classification.subcategory).toBe("Cartão de Visita");

    // Imagens limpas do JSON-LD
    expect(p.images.length).toBeGreaterThan(0);
    expect(p.images[0].is_main).toBe(true);

    // Material/formato/cor separados (nunca no nome)
    const specNames = p.specifications.map((s) => s.normalized_name);
    expect(specNames).toContain("material");
    expect(specNames).toContain("formato");

    // Variante única com tiragens reais
    expect(p.variants.length).toBe(1);
    expect(p.variants[0].price_tiers.length).toBeGreaterThanOrEqual(5);

    // Eixos de variação detectados (formato com várias opções)
    const formato = p.variant_axes.find((a) => a.normalized_name === "formato");
    expect(formato && formato.options.length).toBeGreaterThan(1);
    expect(p.variant_scan_status).toBe("pending");

    // Extras vindos dos blocos Service
    expect(p.extras.some((e) => /cria[cç][aã]o de arte/i.test(e.name))).toBe(true);

    // Não copiamos textos de avaliação — apenas agregados opcionais
    expect((p as any).reviews).toBeUndefined();
  });

  it("processa também o banner sem quebrar", () => {
    const bannerHtml = fixture("futuraim-banner.html");
    const p = parseFuturaImProduct(bannerHtml, "https://www.futuraim.com.br/produto/banner-personalizado?id=22502");
    expect(p.external_id).toBe("22502");
    expect(p.original_name.length).toBeGreaterThan(0);
    expect(p.classification.category).toBe("Comunicação Visual");
  });
});
