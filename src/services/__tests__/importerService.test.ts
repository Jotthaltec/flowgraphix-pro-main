import { describe, it, expect } from "vitest";
import { validateSupplierUrl } from "@/services/urlValidator";
import {
  detectPageType,
  validateImportUrl,
  parseBatchUrls,
  computeDedupKeys,
  stableHash,
} from "@/services/productImporterService";
import type { ImportedProduct } from "@/types/importedProduct";

describe("urlValidator (anti-SSRF, seção 4)", () => {
  it("aceita apenas FuturaIM via HTTPS", () => {
    expect(validateSupplierUrl("https://www.futuraim.com.br/produto/x?id=1").ok).toBe(true);
    expect(validateSupplierUrl("https://futuraim.com.br/cartao-de-visita").ok).toBe(true);
  });

  it("bloqueia http, outros domínios, IPs e hosts internos", () => {
    expect(validateSupplierUrl("http://www.futuraim.com.br/x").ok).toBe(false); // sem HTTPS
    expect(validateSupplierUrl("https://www.printi.com.br/x").ok).toBe(false); // fora da allowlist
    expect(validateSupplierUrl("https://127.0.0.1/x").ok).toBe(false);
    expect(validateSupplierUrl("https://localhost/x").ok).toBe(false);
    expect(validateSupplierUrl("https://192.168.0.1/x").ok).toBe(false);
    expect(validateSupplierUrl("file:///etc/passwd").ok).toBe(false);
    expect(validateSupplierUrl("javascript:alert(1)").ok).toBe(false);
    expect(validateSupplierUrl("ftp://futuraim.com.br/x").ok).toBe(false);
  });
});

describe("detecção de tipo de página (seção 2)", () => {
  it("identifica produto, catálogo e desconhecido", () => {
    expect(detectPageType("https://www.futuraim.com.br/produto/cartao?id=4627")).toBe("product");
    expect(detectPageType("https://www.futuraim.com.br/todos-os-produtos")).toBe("catalog");
    expect(detectPageType("https://www.futuraim.com.br/sobre")).toBe("unknown");
  });

  it("validateImportUrl devolve tipo e id externo", () => {
    const r = validateImportUrl("https://www.futuraim.com.br/produto/cartao?id=4627");
    expect(r.ok).toBe(true);
    expect(r.page_type).toBe("product");
    expect(r.external_id).toBe("4627");
  });
});

describe("modo lote", () => {
  it("parseBatchUrls quebra linhas e remove duplicadas", () => {
    const urls = parseBatchUrls("https://a\n https://b \n\nhttps://a\n");
    expect(urls).toEqual(["https://a", "https://b"]);
  });
});

describe("deduplicação (seção 26)", () => {
  it("stableHash é determinístico", () => {
    expect(stableHash("abc")).toBe(stableHash("abc"));
    expect(stableHash("abc")).not.toBe(stableHash("abd"));
  });

  it("computeDedupKeys deriva chaves de id/url/sku/hash", () => {
    const product = {
      supplier: "FuturaIM",
      external_id: "4627",
      source_url: "https://www.futuraim.com.br/produto/cartao?id=4627",
      canonical_url: "https://www.futuraim.com.br/produto/cartao?id=4627",
      normalized_name: "Cartão de Visita",
      specifications: [
        { name: "Material", normalized_name: "material", value: "Couché", normalized_value: "couche" },
      ],
      variants: [{ sku: "4627", price_tiers: [] }],
    } as unknown as ImportedProduct;

    const keys = computeDedupKeys(product);
    expect(keys.externalKey).toBe("futuraim:id:4627");
    expect(keys.skuKey).toBe("futuraim:sku:4627");
    expect(keys.urlKey).toContain("futuraim:url:futuraim.com.br/produto/cartao?id=4627");
    expect(keys.hashKey.startsWith("futuraim:hash:")).toBe(true);
  });
});
