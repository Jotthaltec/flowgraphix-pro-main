/**
 * Fila persistente de importação de catálogo (seção 30).
 *
 * Persiste o job e seus itens em `product_import_jobs` / `product_import_items`
 * para que uma importação de catálogo sobreviva ao recarregamento da página e
 * possa ser **retomada de onde parou**, sem reprocessar o mesmo link.
 *
 * Todas as operações são tolerantes a falha: se a persistência falhar (ex.: RLS
 * ou tabela ausente em ambiente antigo), o chamador segue em memória.
 */

import { supabase } from "@/integrations/supabase/client";
import type { ImportItemStatus, ImportedProduct } from "@/types/importedProduct";

// As tabelas product_import_jobs/items ainda não estão refletidas no types.ts
// gerado (criadas via migration nova). Acesso por handle sem tipagem estrita.
const db = supabase as any;

export interface ImportJobRow {
  id: string;
  company_id: string;
  import_mode: string;
  source_url: string | null;
  status: string;
  total_found: number;
  total_processed: number;
  total_success: number;
  total_error: number;
  created_at: string;
}

export interface ImportItemRow {
  id: string;
  import_job_id: string;
  source_url: string;
  external_id: string | null;
  status: ImportItemStatus;
  normalized_data: ImportedProduct | null;
  errors: string[] | null;
  product_id: string | null;
}

const externalId = (url: string) => url.match(/[?&]id=(\d+)/)?.[1] ?? null;

const OPEN_STATUSES = ["pendente", "analisando", "extraido", "revisao_necessaria", "pronto_para_importar", "importando"];

/**
 * Cria um job de catálogo e seus itens (deduplicados por id externo / URL).
 * Retorna o job e os itens criados. Em caso de falha, retorna null (modo memória).
 */
export async function createCatalogJob(
  companyId: string,
  sourceUrl: string,
  links: string[],
  supplierId?: string | null,
): Promise<{ job: ImportJobRow; items: ImportItemRow[] } | null> {
  try {
    // Dedup por id externo (ou URL quando não houver id).
    const seen = new Set<string>();
    const uniqueLinks = links.filter((l) => {
      const key = externalId(l) || l;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const { data: job, error: jobErr } = await db
      .from("product_import_jobs")
      .insert({
        company_id: companyId,
        supplier_id: supplierId ?? null,
        import_mode: "catalog",
        source_url: sourceUrl,
        status: "analisando",
        total_found: uniqueLinks.length,
        started_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (jobErr || !job) return null;

    const itemsPayload = uniqueLinks.map((url) => ({
      company_id: companyId,
      import_job_id: job.id,
      source_url: url,
      external_id: externalId(url),
      status: "pendente" as ImportItemStatus,
    }));

    const { data: items, error: itemsErr } = await db
      .from("product_import_items")
      .insert(itemsPayload)
      .select("*");
    if (itemsErr || !items) return null;

    return { job: job as ImportJobRow, items: items as ImportItemRow[] };
  } catch {
    return null;
  }
}

/** Lista jobs em aberto (não finalizados) da empresa, com contagem de itens. */
export async function loadOpenJobs(companyId: string): Promise<ImportJobRow[]> {
  try {
    const { data, error } = await db
      .from("product_import_jobs")
      .select("*")
      .eq("company_id", companyId)
      .in("status", ["pendente", "analisando", "importando"])
      .order("created_at", { ascending: false })
      .limit(10);
    if (error || !data) return [];
    return data as ImportJobRow[];
  } catch {
    return [];
  }
}

/** Carrega os itens de um job (para retomar). */
export async function loadJobItems(jobId: string): Promise<ImportItemRow[]> {
  try {
    const { data, error } = await db
      .from("product_import_items")
      .select("*")
      .eq("import_job_id", jobId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data as ImportItemRow[];
  } catch {
    return [];
  }
}

export const isOpenStatus = (s: ImportItemStatus) => OPEN_STATUSES.includes(s);

/** Atualiza um item da fila (status / dados normalizados / erros / product_id). */
export async function updateImportItem(
  itemId: string,
  patch: Partial<Pick<ImportItemRow, "status" | "normalized_data" | "errors" | "product_id">>,
): Promise<void> {
  try {
    await db.from("product_import_items").update(patch as any).eq("id", itemId);
  } catch {
    /* tolerante a falha */
  }
}

/** Atualiza contadores/estado do job. */
export async function updateImportJob(jobId: string, patch: Partial<ImportJobRow> & { finished_at?: string }): Promise<void> {
  try {
    await db.from("product_import_jobs").update(patch as any).eq("id", jobId);
  } catch {
    /* tolerante a falha */
  }
}

/** Recalcula e grava contadores do job a partir dos status dos itens. */
export async function syncJobCounters(jobId: string): Promise<void> {
  try {
    const items = await loadJobItems(jobId);
    if (!items.length) return;
    const processed = items.filter((i) => !["pendente", "analisando"].includes(i.status)).length;
    const success = items.filter((i) => ["extraido", "importado", "atualizado", "pronto_para_importar"].includes(i.status))
      .length;
    const errorCount = items.filter((i) => ["erro", "bloqueado"].includes(i.status)).length;
    const allDone = items.every((i) => !["pendente", "analisando", "importando"].includes(i.status));
    await updateImportJob(jobId, {
      total_processed: processed,
      total_success: success,
      total_error: errorCount,
      status: allDone ? "importado" : "analisando",
      ...(allDone ? { finished_at: new Date().toISOString() } : {}),
    });
  } catch {
    /* tolerante a falha */
  }
}
