/**
 * Painel de saúde da integração Flow -> loja Nexus.
 *
 * Junta três fontes, todas lidas com a sessão do usuário (RLS):
 *   - store.crm_product_sync_health: status REAL de cada produto publicado
 *     (hash da loja x publicado, edições no Flow, fila, órfão, retirada);
 *   - public.site_products: contagens de imagens/variantes/tiragens e preço;
 *   - public.products: o catálogo do Flow, inclusive o que nunca foi publicado.
 * Nada aqui decide status: só reúne, conta, filtra e exporta.
 */
import type { ProductSyncHealth, ProductSyncStatus } from "@/lib/product-sync";

export type HealthViewRow = ProductSyncHealth & {
  id: string;
  name: string;
  slug: string | null;
  active: boolean;
  auto_sync: boolean | null;
  sync_status: ProductSyncStatus;
  orphan: boolean;
  sync_version: number | null;
};

export type SiteProductRow = {
  id: string;
  categoria: string | null;
  preco_base: number | null;
  imagens: number;
  variantes: number;
  tiragens: number;
};

export type CrmProductRow = {
  id: string;
  name: string;
  commercial_name?: string | null;
  supplier_name: string | null;
  category: string | null;
  status: string | null;
  sale_price: number | null;
  imported_from_supplier: boolean | null;
  updated_at: string | null;
};

/** "not_published": existe no Flow e nunca teve par na loja. */
export type PanelStatus = ProductSyncStatus | "not_published";

export type HealthRow = {
  key: string;
  crmId: string | null;
  storeId: string | null;
  name: string;
  supplier: string | null;
  category: string | null;
  importedFromSupplier: boolean;
  slug: string | null;
  active: boolean;
  status: PanelStatus;
  orphan: boolean;
  autoSync: boolean | null;
  price: number | null;
  images: number;
  variants: number;
  tiers: number;
  syncedAt: string | null;
  crmUpdatedAt: string | null;
  siteUpdatedAt: string | null;
  lastError: string | null;
  /** Linha da view de saúde, para describeSyncHealth. Nula se nunca publicado. */
  health: HealthViewRow | null;
};

export function buildHealthRows(
  health: HealthViewRow[],
  site: SiteProductRow[],
  crm: CrmProductRow[],
): HealthRow[] {
  const siteById = new Map(site.map((s) => [s.id, s]));
  const crmById = new Map(crm.map((c) => [c.id, c]));
  const published = new Set<string>();

  const rows: HealthRow[] = health.map((h) => {
    const s = siteById.get(h.id);
    const c = h.crm_id ? crmById.get(h.crm_id) : undefined;
    if (h.crm_id) published.add(h.crm_id);
    return {
      key: h.id,
      crmId: h.crm_id,
      storeId: h.id,
      name: h.name,
      supplier: c?.supplier_name ?? null,
      category: s?.categoria ?? c?.category ?? null,
      importedFromSupplier: Boolean(c?.imported_from_supplier),
      slug: h.slug,
      active: h.active,
      status: h.sync_status,
      orphan: h.orphan,
      autoSync: h.auto_sync,
      price: s?.preco_base ?? null,
      images: s?.imagens ?? 0,
      variants: s?.variantes ?? 0,
      tiers: s?.tiragens ?? 0,
      syncedAt: h.synced_at,
      crmUpdatedAt: h.crm_updated_at,
      siteUpdatedAt: h.site_updated_at,
      lastError: h.queue_last_error ?? h.last_sync_error,
      health: h,
    };
  });

  for (const c of crm) {
    if (published.has(c.id)) continue;
    rows.push({
      key: `crm:${c.id}`,
      crmId: c.id,
      storeId: null,
      name: c.commercial_name || c.name,
      supplier: c.supplier_name,
      category: c.category,
      importedFromSupplier: Boolean(c.imported_from_supplier),
      slug: null,
      active: false,
      status: "not_published",
      orphan: false,
      autoSync: null,
      price: c.sale_price,
      images: 0,
      variants: 0,
      tiers: 0,
      syncedAt: null,
      crmUpdatedAt: c.updated_at,
      siteUpdatedAt: null,
      lastError: null,
      health: null,
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export type QueueRow = {
  status: "pending" | "processing" | "done" | "error" | "cancelled";
  created_at: string;
};

export type LogRow = {
  created_at: string;
  sucesso: boolean;
  acao: string;
  erro: string | null;
};

export type HealthTotals = {
  crmProducts: number;
  importedFromSupplier: number;
  published: number;
  notPublished: number;
  pending: number;
  stale: number;
  attention: number;
  error: number;
  archived: number;
  orphans: number;
  queueSize: number;
  queueGaveUp: number;
  oldestQueuedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
};

export function computeTotals(rows: HealthRow[], queue: QueueRow[], log: LogRow[]): HealthTotals {
  const count = (s: PanelStatus) => rows.filter((r) => r.status === s).length;
  const open = queue.filter((q) => q.status === "pending" || q.status === "processing");
  const oldest = open.map((q) => q.created_at).sort()[0] ?? null;
  const byDate = [...log].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const lastSuccess = byDate.find((l) => l.sucesso);
  const lastFailure = byDate.find((l) => !l.sucesso);
  return {
    crmProducts: rows.filter((r) => r.crmId && !r.orphan).length,
    importedFromSupplier: rows.filter((r) => r.importedFromSupplier).length,
    published: rows.filter((r) => r.storeId && r.active).length,
    notPublished: count("not_published"),
    pending: count("pending"),
    stale: count("stale"),
    attention: count("attention"),
    error: count("error"),
    archived: count("archived"),
    orphans: rows.filter((r) => r.orphan).length,
    queueSize: open.length,
    queueGaveUp: queue.filter((q) => q.status === "error").length,
    oldestQueuedAt: oldest,
    lastSuccessAt: lastSuccess?.created_at ?? null,
    lastFailureAt: lastFailure?.created_at ?? null,
    lastFailureMessage: lastFailure?.erro ?? null,
  };
}

export type Tri = "all" | "yes" | "no";

export type HealthFilters = {
  search: string;
  statuses: PanelStatus[];
  origin: "all" | "supplier" | "manual";
  supplier: string;
  category: string;
  sync: "all" | "auto" | "manual";
  withPrice: Tri;
  withVariants: Tri;
  withImages: Tri;
  /** yyyy-mm-dd: alterado em qualquer lado a partir desta data. */
  changedSince: string;
};

export const EMPTY_FILTERS: HealthFilters = {
  search: "",
  statuses: [],
  origin: "all",
  supplier: "",
  category: "",
  sync: "all",
  withPrice: "all",
  withVariants: "all",
  withImages: "all",
  changedSince: "",
};

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const tri = (want: Tri, has: boolean) => want === "all" || (want === "yes") === has;

export function applyFilters(rows: HealthRow[], f: HealthFilters): HealthRow[] {
  const q = norm(f.search.trim());
  const since = f.changedSince ? new Date(`${f.changedSince}T00:00:00`).getTime() : null;
  return rows.filter((r) => {
    if (q && !norm(`${r.name} ${r.supplier ?? ""} ${r.slug ?? ""}`).includes(q)) return false;
    if (f.statuses.length && !f.statuses.includes(r.status)) return false;
    if (f.origin === "supplier" && !r.importedFromSupplier) return false;
    if (f.origin === "manual" && r.importedFromSupplier) return false;
    if (f.supplier && r.supplier !== f.supplier) return false;
    if (f.category && r.category !== f.category) return false;
    if (f.sync === "auto" && r.autoSync !== true) return false;
    if (f.sync === "manual" && r.autoSync !== false) return false;
    if (!tri(f.withPrice, (r.price ?? 0) > 0)) return false;
    if (!tri(f.withVariants, r.variants > 0)) return false;
    if (!tri(f.withImages, r.images > 0)) return false;
    if (since !== null) {
      const last = Math.max(
        ...[r.syncedAt, r.crmUpdatedAt, r.siteUpdatedAt].map((d) => (d ? Date.parse(d) : 0)),
      );
      if (last < since) return false;
    }
    return true;
  });
}

export type RowAction = "publish" | "retry" | "unpublish" | "archive";

/** O que faz sentido para cada linha. Órfão não tem ação: vai para reconciliação. */
export function rowActions(r: HealthRow): RowAction[] {
  if (r.orphan || !r.crmId) return [];
  switch (r.status) {
    case "not_published":
    case "pending":
    case "archived":
      return ["publish"];
    case "error":
      return ["retry", "unpublish", "archive"];
    default:
      return ["publish", "unpublish", "archive"];
  }
}

export type BulkResult = { key: string; name: string; ok: boolean; message: string };

/**
 * Executa uma ação item a item, em sequência. Uma falha não interrompe as
 * demais; cada item tem seu resultado, na ordem em que foi pedido.
 */
export async function runBulk<T extends { key: string; name: string }>(
  items: T[],
  action: (item: T) => Promise<string>,
  onProgress?: (done: number, total: number) => void,
): Promise<BulkResult[]> {
  const results: BulkResult[] = [];
  for (const item of items) {
    try {
      results.push({ key: item.key, name: item.name, ok: true, message: await action(item) });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ key: item.key, name: item.name, ok: false, message });
    }
    onProgress?.(results.length, items.length);
  }
  return results;
}

const CSV_COLUMNS: [string, (r: HealthRow) => string | number | boolean | null][] = [
  ["Produto", (r) => r.name],
  ["Status", (r) => r.status],
  ["Divergência", (r) => r.health?.divergence ?? ""],
  ["Órfão", (r) => (r.orphan ? "sim" : "não")],
  ["Ativo na loja", (r) => (r.active ? "sim" : "não")],
  ["Fornecedor", (r) => r.supplier],
  ["Categoria", (r) => r.category],
  ["Preço base", (r) => (r.price == null ? "" : r.price.toFixed(2).replace(".", ","))],
  ["Imagens", (r) => r.images],
  ["Variantes", (r) => r.variants],
  ["Tiragens", (r) => r.tiers],
  ["Publicação automática", (r) => (r.autoSync == null ? "" : r.autoSync ? "sim" : "não")],
  ["Publicado em", (r) => r.syncedAt],
  ["Alterado no Flow", (r) => r.crmUpdatedAt],
  ["Alterado na loja", (r) => r.siteUpdatedAt],
  ["Fila", (r) => r.health?.queue_status ?? ""],
  ["Último erro", (r) => r.lastError],
  ["Slug", (r) => r.slug],
  ["ID no Flow", (r) => r.crmId],
  ["ID na loja", (r) => r.storeId],
];

/** CSV com ";" e BOM, para abrir direto no Excel em português. */
export function toCsv(rows: HealthRow[]): string {
  const cell = (v: string | number | boolean | null) => {
    const s = v == null ? "" : String(v);
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    CSV_COLUMNS.map(([h]) => cell(h)).join(";"),
    ...rows.map((r) => CSV_COLUMNS.map(([, get]) => cell(get(r))).join(";")),
  ];
  return "﻿" + lines.join("\r\n");
}
