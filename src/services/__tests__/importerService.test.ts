import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateSupplierUrl } from "@/services/urlValidator";
import {
  detectPageType,
  validateImportUrl,
  parseBatchUrls,
  computeDedupKeys,
  stableHash,
  buildProductRow,
} from "@/services/productImporterService";
import { parseFuturaImProduct } from "@/services/futuraImParser";
import type { ImportedProduct } from "@/types/importedProduct";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");

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

describe("buildProductRow leva TODAS as variações para a tabela products", () => {
  const product = parseFuturaImProduct(
    fixture("futuraim-cartao-de-visita.html"),
    "https://www.futuraim.com.br/produto/cartao-de-visita?id=4627",
  );
  const row = buildProductRow(product, { companyId: "c1", marginPercent: 50 }) as any;

  it("grava os eixos de variação (Material/Formato/Cor/...) em products.variations", () => {
    // Deve espelhar os eixos extraídos pelo parser — não pode vir vazio.
    expect(product.variant_axes.length).toBeGreaterThan(0);
    expect(Array.isArray(row.variations)).toBe(true);
    expect(row.variations.length).toBe(product.variant_axes.length);

    const nomes = row.variations.map((v: any) => v.name);
    expect(nomes).toContain("Formato");

    // Cada eixo carrega suas opções no formato lido pelo editor ({ value }).
    const formato = row.variations.find((v: any) => v.name === "Formato");
    expect(formato.values.length).toBeGreaterThan(0);
    expect(formato.values[0]).toHaveProperty("value");
  });

  it("marca o produto como importado do fornecedor e não perde extras/gabaritos", () => {
    expect(row.imported_from_supplier).toBe(true);
    expect(Array.isArray(row.extra_services)).toBe(true);
    expect(Array.isArray(row.template_links)).toBe(true);
    expect(row.extra_services.length).toBe(product.extras.length);
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
