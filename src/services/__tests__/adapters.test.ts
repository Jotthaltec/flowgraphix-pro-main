import { describe, it, expect } from "vitest";
import {
  parseWithAdapter,
  rankAdapters,
  resolveAdapter,
  getAdapters,
  registerAdapter,
  unregisterAdapter,
  FuturaImAdapter,
  GenericJsonLdAdapter,
} from "@/services/adapters";
import type { SupplierAdapter } from "@/services/adapters";

const JSONLD_PAGE = `<!doctype html><html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Adesivo Vinil Brilho",
  "sku": "ADV-123",
  "brand": { "@type": "Brand", "name": "GrafPrint" },
  "description": "Adesivo em vinil branco brilho para recorte.",
  "image": ["https://cdn.exemplo.com/a.jpg", "https://cdn.exemplo.com/b.jpg"],
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.7", "reviewCount": "31" },
  "offers": { "@type": "Offer", "price": "89.90", "priceCurrency": "BRL", "availability": "https://schema.org/InStock" }
}
</script>
<script type="application/ld+json">
{ "@type": "BreadcrumbList", "itemListElement": [
  { "@type": "ListItem", "position": 1, "name": "Adesivos" },
  { "@type": "ListItem", "position": 2, "name": "Vinil" }
] }
</script>
</head><body>...</body></html>`;

const GRAPH_PAGE = `<html><head><script type="application/ld+json">
{ "@context":"https://schema.org","@graph":[
  {"@type":"WebSite","name":"Loja"},
  {"@type":"Product","name":"Banner Lona","offers":{"@type":"AggregateOffer","lowPrice":"45,00","priceCurrency":"BRL"}}
]}
</script></head><body></body></html>`;

describe("registry de adaptadores", () => {
  it("registra os nativos (futuraim + generic_jsonld)", () => {
    const keys = getAdapters().map((a) => a.key);
    expect(keys).toContain("futuraim");
    expect(keys).toContain("generic_jsonld");
  });

  it("FuturaImAdapter casa só o domínio da FuturaIM", () => {
    expect(FuturaImAdapter.matchScore({ url: "https://futuraim.com.br/p", domain: "futuraim.com.br" }).score).toBe(1);
    expect(FuturaImAdapter.matchScore({ url: "https://outro.com/p", domain: "outro.com" }).score).toBe(0);
  });

  it("domínio específico vence o genérico no ranking", () => {
    const ranked = rankAdapters({ url: "https://futuraim.com.br/p", domain: "futuraim.com.br", html: JSONLD_PAGE });
    expect(ranked[0].adapter.key).toBe("futuraim");
  });

  it("cai no genérico JSON-LD quando o domínio é desconhecido", () => {
    const match = resolveAdapter({ url: "https://loja.com/p", domain: "loja.com", html: JSONLD_PAGE });
    expect(match?.adapter.key).toBe("generic_jsonld");
    expect(match!.score).toBeGreaterThan(0.5);
  });

  it("não resolve nada quando nenhum adaptador casa", () => {
    const match = resolveAdapter({ url: "https://loja.com/p", domain: "loja.com", html: "<html>sem dados</html>" });
    expect(match).toBeNull();
  });

  it("preferKey reutiliza o adaptador do perfil aprovado", () => {
    const match = resolveAdapter(
      { url: "https://loja.com/p", domain: "loja.com", html: JSONLD_PAGE },
      "generic_jsonld",
    );
    expect(match?.adapter.key).toBe("generic_jsonld");
    expect(match?.reason).toContain("perfil aprovado");
  });

  it("permite registrar/desregistrar um adaptador customizado", () => {
    const custom: SupplierAdapter = {
      key: "teste_x",
      label: "Teste",
      domains: ["fornecedor-x.com"],
      matchScore: (ctx) => (ctx.domain === "fornecedor-x.com" ? { score: 1, reason: "x" } : { score: 0, reason: "-" }),
      parseProduct: () => ({}) as never,
    };
    registerAdapter(custom);
    expect(getAdapters().map((a) => a.key)).toContain("teste_x");
    unregisterAdapter("teste_x");
    expect(getAdapters().map((a) => a.key)).not.toContain("teste_x");
  });
});

describe("GenericJsonLdAdapter — parse real (sem mock)", () => {
  it("extrai nome, preço, imagens, sku, marca, rating e breadcrumb", () => {
    const { product, adapterKey, confidence } = parseWithAdapter(JSONLD_PAGE, "https://loja.com/produto/adesivo");
    expect(adapterKey).toBe("generic_jsonld");
    expect(confidence).toBeGreaterThan(0.5);
    expect(product).not.toBeNull();
    const p = product!;
    expect(p.original_name).toBe("Adesivo Vinil Brilho");
    expect(p.external_id).toBe("ADV-123");
    expect(p.brand).toBe("GrafPrint");
    expect(p.images.map((i) => i.url)).toEqual([
      "https://cdn.exemplo.com/a.jpg",
      "https://cdn.exemplo.com/b.jpg",
    ]);
    expect(p.images[0].is_main).toBe(true);
    expect(p.breadcrumb).toEqual(["Adesivos", "Vinil"]);
    expect(p.rating_average).toBeCloseTo(4.7);
    expect(p.rating_count).toBe(31);
    expect(p.available).toBe(true);
    expect(p.variants[0].price_tiers[0].total_price).toBeCloseTo(89.9);
    expect(p.variants[0].price_tiers[0].currency).toBe("BRL");
    expect(p.errors).toHaveLength(0);
  });

  it("lê Product dentro de @graph e AggregateOffer (lowPrice com vírgula BR)", () => {
    const { product } = parseWithAdapter(GRAPH_PAGE, "https://loja.com/banner");
    expect(product?.original_name).toBe("Banner Lona");
    expect(product?.variants[0].price_tiers[0].total_price).toBeCloseTo(45);
  });

  it("gera warnings (não erro) quando faltam campos, sem fabricar dados", () => {
    const html = `<html><head><script type="application/ld+json">
      {"@type":"Product","name":"Só Nome"}
    </script></head></html>`;
    const { product } = parseWithAdapter(html, "https://loja.com/x");
    expect(product?.original_name).toBe("Só Nome");
    expect(product?.variants[0]?.price_tiers ?? []).toHaveLength(0);
    expect(product?.warnings.join(" ")).toMatch(/preço|imagens/i);
    expect(product?.unavailable).toBe(true);
  });
});
