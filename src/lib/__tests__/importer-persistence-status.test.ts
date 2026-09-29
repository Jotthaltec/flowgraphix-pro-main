import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportedProduct } from "@/types/importedProduct";

// Cliente Supabase simulado: registra insert/update em `products` e responde à
// busca de duplicados (por source_url) conforme `existingRow`.
const SOURCE_URL = "https://fornecedor.example/produto?id=42";
const writes: { op: "insert" | "update"; payload: Record<string, unknown> }[] = [];
let existingRow: { id: string; name: string; source_url: string } | null = null;

function chain(op: "select" | "insert" | "update") {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "not", "ilike", "in", "maybeSingle", "single"]) c[m] = () => c;
  c.update = (payload: Record<string, unknown>) => {
    writes.push({ op: "update", payload });
    return chain("update");
  };
  c.insert = (payload: Record<string, unknown>) => {
    writes.push({ op: "insert", payload });
    return chain("insert");
  };
  c.then = (resolve: (v: unknown) => void) =>
    resolve(
      op === "insert"
        ? { data: { id: "novo" }, error: null }
        : op === "update"
          ? { error: null }
          : { data: existingRow ? [existingRow] : [], error: null },
    );
  return c;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => chain("select") } }));
vi.mock("@/services/productImporterService", () => ({
  buildProductRow: () => ({ name: "Cartão", status: "Ativo" }),
}));
vi.mock("@/lib/importer-structured-persistence", () => ({
  persistStructured: async () => ({ warnings: [] }),
}));
vi.mock("@/lib/importer-image-storage", () => ({ copyImagesToStorage: async () => ({}) }));
vi.mock("@/lib/supplier-link", () => ({ resolveSupplierByUrl: async () => null }));

const { persistImportedProduct } = await import("@/lib/importer-persistence");
const { productStatusRule } = await import("@/lib/importer-publication");

const product = { source_url: SOURCE_URL, images: [], variants: [] } as unknown as ImportedProduct;
const base = {
  companyId: "c1",
  marginPercent: 50,
  supplierId: "s1",
  writeStructured: false,
  updateExisting: true,
};

const productWrite = () => writes.find((w) => w.op === "insert" || w.op === "update")!;

beforeEach(() => {
  writes.length = 0;
  existingRow = null;
});

describe("status do produto ao importar", () => {
  it("rascunho cria o produto como Rascunho", async () => {
    const r = await persistImportedProduct(product, {
      ...base,
      productStatus: productStatusRule("draft"),
    });
    expect(r.action).toBe("created");
    expect(productWrite()).toMatchObject({ op: "insert", payload: { status: "Rascunho" } });
  });

  it("atualizar um existente mantém o status atual (arquivado não volta sozinho)", async () => {
    existingRow = { id: "existente", name: "Cartão", source_url: SOURCE_URL };
    for (const dest of ["draft", "crm"] as const) {
      writes.length = 0;
      const r = await persistImportedProduct(product, {
        ...base,
        productStatus: productStatusRule(dest),
      });
      expect(r).toMatchObject({ action: "updated", productId: "existente" });
      expect(productWrite().op).toBe("update");
      expect(productWrite().payload).not.toHaveProperty("status");
    }
  });

  it("publicar deixa o existente Ativo, por ser pedido explícito", async () => {
    existingRow = { id: "existente", name: "Cartão", source_url: SOURCE_URL };
    await persistImportedProduct(product, { ...base, productStatus: productStatusRule("publish") });
    expect(productWrite()).toMatchObject({ op: "update", payload: { status: "Ativo" } });
  });

  it("sem regra, o comportamento antigo continua (compatibilidade)", async () => {
    await persistImportedProduct(product, base);
    expect(productWrite()).toMatchObject({ op: "insert", payload: { status: "Ativo" } });
  });

  it("existente com atualização desativada não é tocado", async () => {
    existingRow = { id: "existente", name: "Cartão", source_url: SOURCE_URL };
    const r = await persistImportedProduct(product, {
      ...base,
      updateExisting: false,
      productStatus: productStatusRule("publish"),
    });
    expect(r.action).toBe("skipped");
    expect(writes).toHaveLength(0);
  });
});
