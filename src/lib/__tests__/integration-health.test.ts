import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  applyFilters,
  buildHealthRows,
  computeTotals,
  rowActions,
  runBulk,
  toCsv,
  type CrmProductRow,
  type HealthRow,
  type HealthViewRow,
  type SiteProductRow,
} from "@/lib/integration-health";

function health(p: Partial<HealthViewRow> & { id: string; name: string }): HealthViewRow {
  return {
    crm_id: null,
    slug: null,
    active: true,
    auto_sync: true,
    sync_status: "synced",
    orphan: false,
    sync_version: 1,
    divergence: null,
    synced_at: "2026-09-29T10:00:00Z",
    crm_updated_at: "2026-09-29T09:00:00Z",
    site_updated_at: "2026-09-29T10:00:00Z",
    last_sync_error: null,
    queue_status: null,
    queue_attempts: null,
    queue_next_attempt_at: null,
    queue_last_error: null,
    ...p,
  };
}

const crm = (p: Partial<CrmProductRow> & { id: string; name: string }): CrmProductRow => ({
  supplier_name: null,
  category: null,
  status: "Ativo",
  sale_price: 10,
  imported_from_supplier: false,
  updated_at: "2026-09-29T09:00:00Z",
  ...p,
});

const site = (id: string, p: Partial<SiteProductRow> = {}): SiteProductRow => ({
  id,
  categoria: "Cartões",
  preco_base: 1.14,
  imagens: 4,
  variantes: 13,
  tiragens: 10,
  ...p,
});

const views: HealthViewRow[] = [
  health({ id: "s1", crm_id: "c1", name: "Cartão", slug: "cartao" }),
  health({
    id: "s2",
    crm_id: "c2",
    name: "Banner",
    sync_status: "stale",
    divergence: "flow",
    queue_status: "pending",
  }),
  health({
    id: "s3",
    crm_id: "c3",
    name: "Adesivo",
    sync_status: "error",
    last_sync_error: "Defina a categoria",
  }),
  health({
    id: "s4",
    crm_id: "c9",
    name: "Órfão",
    sync_status: "attention",
    divergence: "orfao",
    orphan: true,
  }),
  health({
    id: "s5",
    crm_id: "c5",
    name: "Arquivado",
    sync_status: "archived",
    active: false,
    archived_at: "2026-09-29T11:00:00Z",
  }),
];
const crmRows = [
  crm({ id: "c1", name: "Cartão", supplier_name: "Futura", imported_from_supplier: true }),
  crm({ id: "c2", name: "Banner" }),
  crm({ id: "c3", name: "Adesivo" }),
  crm({ id: "c5", name: "Arquivado" }),
  crm({ id: "c6", name: "Flyer", commercial_name: "Flyer A5", sale_price: 0 }),
];
const siteRows = [
  site("s1"),
  site("s2", { imagens: 0 }),
  site("s3", { variantes: 0 }),
  site("s4"),
  site("s5"),
];

const rows = buildHealthRows(views, siteRows, crmRows);
const byName = (n: string) => rows.find((r) => r.name === n)!;

describe("buildHealthRows", () => {
  it("junta status real, contagens da loja e fornecedor do Flow", () => {
    expect(byName("Cartão")).toMatchObject({
      status: "synced",
      supplier: "Futura",
      importedFromSupplier: true,
      images: 4,
      variants: 13,
      category: "Cartões",
    });
  });

  it("inclui produto do Flow que nunca foi publicado, pelo nome comercial", () => {
    expect(byName("Flyer A5")).toMatchObject({
      status: "not_published",
      storeId: null,
      crmId: "c6",
    });
  });

  it("mantém o órfão, que não tem par no Flow", () => {
    expect(byName("Órfão")).toMatchObject({ orphan: true, supplier: null });
  });

  it("usa o erro da fila antes do erro gravado", () => {
    const r = buildHealthRows(
      [
        health({
          id: "x",
          crm_id: "cx",
          name: "X",
          last_sync_error: "velho",
          queue_last_error: "novo",
        }),
      ],
      [],
      [],
    );
    expect(r[0].lastError).toBe("novo");
  });
});

describe("computeTotals", () => {
  it("conta cada status, órfãos, fila e última sincronização", () => {
    const t = computeTotals(
      rows,
      [
        { status: "pending", created_at: "2026-09-29T08:00:00Z" },
        { status: "processing", created_at: "2026-09-29T07:00:00Z" },
        { status: "error", created_at: "2026-09-28T07:00:00Z" },
        { status: "done", created_at: "2026-09-27T07:00:00Z" },
      ],
      [
        { created_at: "2026-09-29T10:00:00Z", sucesso: true, acao: "update", erro: null },
        { created_at: "2026-09-29T11:00:00Z", sucesso: false, acao: "erro", erro: "falhou" },
        { created_at: "2026-09-29T09:00:00Z", sucesso: true, acao: "insert", erro: null },
      ],
    );
    expect(t).toMatchObject({
      crmProducts: 5,
      importedFromSupplier: 1,
      published: 4,
      notPublished: 1,
      stale: 1,
      attention: 1,
      error: 1,
      archived: 1,
      orphans: 1,
      queueSize: 2,
      queueGaveUp: 1,
      oldestQueuedAt: "2026-09-29T07:00:00Z",
      lastSuccessAt: "2026-09-29T10:00:00Z",
      lastFailureAt: "2026-09-29T11:00:00Z",
      lastFailureMessage: "falhou",
    });
  });
});

describe("applyFilters", () => {
  const names = (r: HealthRow[]) => r.map((x) => x.name).sort();

  it("sem filtro devolve tudo", () => {
    expect(applyFilters(rows, EMPTY_FILTERS)).toHaveLength(rows.length);
  });

  it("filtra por status, origem, fornecedor e categoria", () => {
    expect(names(applyFilters(rows, { ...EMPTY_FILTERS, statuses: ["stale", "error"] }))).toEqual([
      "Adesivo",
      "Banner",
    ]);
    expect(names(applyFilters(rows, { ...EMPTY_FILTERS, origin: "supplier" }))).toEqual(["Cartão"]);
    expect(names(applyFilters(rows, { ...EMPTY_FILTERS, supplier: "Futura" }))).toEqual(["Cartão"]);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, category: "Cartões" })).toHaveLength(5);
  });

  it("filtra com ou sem preço, variantes e imagens", () => {
    expect(names(applyFilters(rows, { ...EMPTY_FILTERS, withPrice: "no" }))).toEqual(["Flyer A5"]);
    expect(names(applyFilters(rows, { ...EMPTY_FILTERS, withImages: "no" }))).toEqual([
      "Banner",
      "Flyer A5",
    ]);
    expect(
      applyFilters(rows, { ...EMPTY_FILTERS, withVariants: "no" }).map((r) => r.name),
    ).toContain("Adesivo");
  });

  it("busca sem acento e por data de alteração", () => {
    expect(names(applyFilters(rows, { ...EMPTY_FILTERS, search: "cartao" }))).toEqual(["Cartão"]);
    const late = buildHealthRows(
      [
        health({
          id: "a",
          crm_id: "ca",
          name: "Antigo",
          synced_at: "2026-08-01T00:00:00Z",
          crm_updated_at: "2026-08-01T00:00:00Z",
          site_updated_at: "2026-08-01T00:00:00Z",
        }),
      ],
      [],
      [],
    );
    expect(applyFilters(late, { ...EMPTY_FILTERS, changedSince: "2026-09-01" })).toHaveLength(0);
    expect(applyFilters(late, { ...EMPTY_FILTERS, changedSince: "2026-07-01" })).toHaveLength(1);
  });

  it("publicação automática ou manual", () => {
    const manual = buildHealthRows(
      [health({ id: "m", crm_id: "cm", name: "M", auto_sync: false })],
      [],
      [],
    );
    expect(applyFilters(manual, { ...EMPTY_FILTERS, sync: "auto" })).toHaveLength(0);
    expect(applyFilters(manual, { ...EMPTY_FILTERS, sync: "manual" })).toHaveLength(1);
  });
});

describe("rowActions", () => {
  it("oferece só o que faz sentido para cada status", () => {
    expect(rowActions(byName("Flyer A5"))).toEqual(["publish"]);
    expect(rowActions(byName("Arquivado"))).toEqual(["publish"]);
    expect(rowActions(byName("Adesivo"))).toEqual(["retry", "unpublish", "archive"]);
    expect(rowActions(byName("Banner"))).toEqual(["publish", "unpublish", "archive"]);
  });

  it("órfão não tem ação automática", () => {
    expect(rowActions(byName("Órfão"))).toEqual([]);
  });
});

describe("runBulk", () => {
  it("isola falhas e devolve um resultado por item, em ordem", async () => {
    const progress: number[] = [];
    const results = await runBulk(
      [
        { key: "1", name: "A" },
        { key: "2", name: "B" },
        { key: "3", name: "C" },
      ],
      async (item) => {
        if (item.key === "2") throw new Error("Sem permissao");
        return `ok ${item.name}`;
      },
      (done) => progress.push(done),
    );
    expect(results).toEqual([
      { key: "1", name: "A", ok: true, message: "ok A" },
      { key: "2", name: "B", ok: false, message: "Sem permissao" },
      { key: "3", name: "C", ok: true, message: "ok C" },
    ]);
    expect(progress).toEqual([1, 2, 3]);
  });
});

describe("toCsv", () => {
  it("usa ponto e vírgula, BOM e escapa texto com separador", () => {
    const csv = toCsv([{ ...byName("Adesivo"), lastError: 'Falhou; "categoria"' }]);
    expect(csv.startsWith("﻿Produto;Status;")).toBe(true);
    const [, line] = csv.split("\r\n");
    expect(line).toContain('"Falhou; ""categoria"""');
    expect(line.split(";")[0]).toBe("Adesivo");
  });

  it("preço em formato brasileiro", () => {
    const [, line] = toCsv([byName("Cartão")]).split("\r\n");
    expect(line).toContain(";1,14;");
  });
});
