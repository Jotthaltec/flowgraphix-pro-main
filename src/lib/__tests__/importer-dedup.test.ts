import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportedProduct } from "@/types/importedProduct";

// Banco simulado: cada consulta a `products` devolve as linhas da empresa que
// casam com os filtros eq/ilike aplicados (o suficiente para a deduplicação).
type Row = Record<string, string | null>;
let rows: Row[] = [];

function query() {
  const filters: ((r: Row) => boolean)[] = [];
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.eq = (col: string, val: string) => (filters.push((r) => r[col] === val), q);
  q.not = (col: string, _op: string, _val: null) => (filters.push((r) => r[col] != null), q);
  q.ilike = (col: string, val: string) => (
    filters.push((r) => (r[col] ?? "").toLowerCase() === val.toLowerCase()),
    q
  );
  const result = () => rows.filter((r) => filters.every((f) => f(r)));
  q.maybeSingle = () => Promise.resolve({ data: result()[0] ?? null, error: null });
  q.then = (resolve: (v: unknown) => void) => resolve({ data: result(), error: null });
  return q;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => query() } }));
vi.mock("@/services/productImporterService", () => ({ buildProductRow: () => ({}) }));
vi.mock("@/lib/importer-structured-persistence", () => ({
  persistStructured: async () => ({ warnings: [] }),
}));
vi.mock("@/lib/importer-image-storage", () => ({ copyImagesToStorage: async () => ({}) }));
vi.mock("@/lib/supplier-link", () => ({ resolveSupplierByUrl: async () => null }));

const { findExistingProduct, normalizeUrlForMatch } = await import("@/lib/importer-persistence");

const product = (p: Partial<ImportedProduct>) =>
  ({
    source_url: null,
    external_id: null,
    original_name: "",
    supplier: null,
    ...p,
  }) as unknown as ImportedProduct;

describe("normalizeUrlForMatch", () => {
  it("ignora protocolo, www, barra final e maiúsculas no caminho", () => {
    const a = normalizeUrlForMatch("https://www.futuraim.com.br/Produto/Cartao/");
    expect(a).toBe(normalizeUrlForMatch("http://futuraim.com.br/produto/cartao"));
  });

  it("descarta parâmetros de rastreamento, mas mantém a identidade do produto", () => {
    expect(
      normalizeUrlForMatch("https://futuraim.com.br/produto/cartao?id=4581&utm_source=x&fbclid=y"),
    ).toBe("futuraim.com.br/produto/cartao?id=4581");
    expect(normalizeUrlForMatch("https://futuraim.com.br/produto/cartao?id=4581")).not.toBe(
      normalizeUrlForMatch("https://futuraim.com.br/produto/cartao?id=4627"),
    );
  });

  it("ordem dos parâmetros não importa", () => {
    expect(normalizeUrlForMatch("https://x.com/p?b=2&a=1")).toBe(
      normalizeUrlForMatch("https://x.com/p?a=1&b=2"),
    );
  });

  it("nulo e texto que não é URL não quebram", () => {
    expect(normalizeUrlForMatch(null)).toBeNull();
    expect(normalizeUrlForMatch(" www.x.com/p/ ")).toBe("x.com/p");
  });
});

describe("findExistingProduct", () => {
  beforeEach(() => {
    rows = [
      {
        id: "p1",
        name: "Cartão de Visita em Couché Brilho",
        company_id: "c1",
        source_url: "https://www.futuraim.com.br/produto/cartao-de-visita?id=4581",
        supplier_sku: "4581",
        origin: "supplier_import",
        supplier_name: "FuturaIM",
      },
      {
        id: "outra-empresa",
        name: "Cartão de Visita em Couché Brilho",
        company_id: "c2",
        source_url: "https://futuraim.com.br/produto/cartao-de-visita?id=4581",
        supplier_sku: "4581",
        origin: "supplier_import",
        supplier_name: "FuturaIM",
      },
    ];
  });

  it("reconhece pela URL normalizada, só dentro da empresa", async () => {
    const hit = await findExistingProduct(
      product({
        source_url: "http://futuraim.com.br/produto/cartao-de-visita/?id=4581&utm_medium=x",
      }),
      "c1",
    );
    expect(hit).toEqual({
      id: "p1",
      name: "Cartão de Visita em Couché Brilho",
      matched_by: "source_url",
    });
  });

  it("sem URL igual, reconhece pelo código do fornecedor", async () => {
    const hit = await findExistingProduct(
      product({ source_url: "https://futuraim.com.br/novo-link?id=9999", external_id: "4581" }),
      "c1",
    );
    expect(hit?.matched_by).toBe("supplier_sku");
  });

  it("link e código mudaram: reconhece por nome (sem acento/maiúscula) + fornecedor", async () => {
    const hit = await findExistingProduct(
      product({
        source_url: "https://futuraim.com.br/x?id=1",
        external_id: "1",
        original_name: "CARTAO DE VISITA  EM COUCHE BRILHO",
        supplier: "futuraim",
      }),
      "c1",
    );
    expect(hit).toMatchObject({ id: "p1", matched_by: "name_supplier" });
  });

  it("produto novo não casa com nada", async () => {
    const hit = await findExistingProduct(
      product({
        source_url: "https://futuraim.com.br/produto/banner?id=77",
        external_id: "77",
        original_name: "Banner",
        supplier: "FuturaIM",
      }),
      "c1",
    );
    expect(hit).toBeNull();
  });

  it("nunca devolve produto de outra empresa", async () => {
    rows = rows.filter((r) => r.company_id === "c2");
    const hit = await findExistingProduct(
      product({
        source_url: "https://futuraim.com.br/produto/cartao-de-visita?id=4581",
        external_id: "4581",
      }),
      "c1",
    );
    expect(hit).toBeNull();
  });
});
