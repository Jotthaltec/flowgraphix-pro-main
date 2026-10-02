import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hasBearerSecret } from "@/lib/bearer-auth.server";
import {
  applyCostUpdate,
  checkProductPrice,
  type ImportedProductRow,
  type StoredTier,
} from "@/lib/importer-price-update";
import { buildPriceTable } from "@/services/supplierPricing";
import type { Json } from "@/integrations/supabase/types";

/**
 * Coleta diária de preços do fornecedor (Vercel Cron, `vercel.json`).
 *
 * Para cada produto importado e publicado na loja: reabre o link do
 * fornecedor, aplica a regra de services/supplierPricing (mudança normal só
 * mexe no custo; promoção vira "de/por"; fim da promoção volta ao normal) e
 * grava em public.products — o gatilho do Flow republica na loja pela fila.
 * Sem mudança, nada é gravado. Alertas vão para public.supplier_alerts.
 * Responde só com contagens.
 */
const BATCH = Number(process.env.SUPPLIER_PRICE_BATCH ?? 40);

type Alert = {
  company_id: string;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  data: Json;
};

async function run() {
  const store = supabaseAdmin.schema("store");
  const { data: published, error: pubError } = await store
    .from("products")
    .select("crm_id")
    .eq("sync_origin", "crm")
    .is("archived_at", null)
    .not("crm_id", "is", null);
  if (pubError) throw new Error(`loja: ${pubError.code}`);
  const crmIds = (published ?? []).map((p) => p.crm_id as string);
  if (!crmIds.length) return { status: "done" as const, checked: 0, counts: {} };

  const { data: rows, error } = await supabaseAdmin
    .from("products")
    .select(
      "id, company_id, name, source_url, supplier_sku, cost_price, sale_price, margin_percent, quantity_price_table, production_deadline",
    )
    .in("id", crmIds)
    .eq("origin", "supplier_import")
    .not("source_url", "is", null)
    .order("updated_at", { ascending: true })
    .limit(BATCH);
  if (error) throw new Error(`produtos: ${error.code}`);

  const counts: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);
  const alerts: Alert[] = [];

  for (const raw of rows ?? []) {
    const row: ImportedProductRow = {
      ...raw,
      quantity_price_table: Array.isArray(raw.quantity_price_table)
        ? (raw.quantity_price_table as StoredTier[])
        : null,
    };
    const companyId = raw.company_id as string;
    const base = { company_id: companyId, data: { product_id: row.id, name: row.name } as Json };
    try {
      const result = await checkProductPrice(row);
      if (result.error || !result.fresh || !result.comparison) {
        bump("erro_coleta");
        alerts.push({
          ...base,
          alert_type: "erro_coleta",
          severity: "warning",
          title: `Não foi possível conferir o preço: ${row.name}`,
          message: result.error ?? "Coleta sem resultado.",
        });
        continue;
      }
      if (result.comparison.unavailable) {
        bump("indisponivel");
        alerts.push({
          ...base,
          alert_type: "indisponivel",
          severity: "critical",
          title: `Produto indisponível no fornecedor: ${row.name}`,
          message: "Preço mantido. Avalie despublicar o produto na loja.",
        });
        continue;
      }

      // Sem custo novo, faixa nova/removida, nem mudança de promoção: nada a gravar.
      const preview = buildPriceTable(
        row.quantity_price_table,
        result.fresh.variants[0]?.price_tiers ?? [],
        Number(row.margin_percent) || 50,
      );
      const promoChanged = preview.promoStarted.length > 0 || preview.promoEnded.length > 0;
      if (result.comparison.status === "unchanged" && !promoChanged) {
        bump("sem_mudanca");
        continue;
      }

      const pricing = await applyCostUpdate(result, companyId, supabaseAdmin);
      bump("atualizado");
      if (!pricing) continue;
      if (pricing.promoStarted.length) {
        alerts.push({
          ...base,
          alert_type: "promocao_inicio",
          severity: "info",
          title: `Promoção do fornecedor aplicada na loja: ${row.name}`,
          message: `Tiragens em promoção: ${pricing.promoStarted.join(", ")}.`,
        });
      }
      if (pricing.promoEnded.length) {
        alerts.push({
          ...base,
          alert_type: "promocao_fim",
          severity: "info",
          title: `Promoção encerrada, preço normal restabelecido: ${row.name}`,
          message: `Tiragens: ${pricing.promoEnded.join(", ")}.`,
        });
      }
      for (const a of pricing.alerts) {
        if (a.kind === "promocao_longa") {
          alerts.push({
            ...base,
            alert_type: a.kind,
            severity: "warning",
            title: `Promoção há ${a.days} dias: ${row.name} (${a.quantity} un)`,
            message:
              "O custo do fornecedor segue abaixo do normal. Se for o novo preço, ajuste o preço de venda no Flow para encerrar a promoção.",
            data: {
              product_id: row.id,
              name: row.name,
              quantity: a.quantity,
              days: a.days ?? null,
            },
          });
          continue;
        }
        alerts.push({
          ...base,
          alert_type: a.kind,
          severity: a.kind === "prejuizo" ? "critical" : "warning",
          title:
            a.kind === "prejuizo"
              ? `Venda abaixo do custo: ${row.name} (${a.quantity} un)`
              : `Margem baixa: ${row.name} (${a.quantity} un)`,
          message: `Margem atual ${a.marginPercent}%. O preço de venda não foi alterado; revise no Flow.`,
          data: {
            product_id: row.id,
            name: row.name,
            quantity: a.quantity,
            margin: a.marginPercent,
          },
        });
      }
    } catch (err) {
      bump("falha");
      console.error("[precos.fornecedor] falha no produto", {
        product: row.id,
        reason: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  if (alerts.length) {
    const { error: alertError } = await supabaseAdmin.from("supplier_alerts").insert(alerts);
    if (alertError)
      console.error("[precos.fornecedor] alertas não gravados", { code: alertError.code });
  }
  return { status: "done" as const, checked: rows?.length ?? 0, counts, alerts: alerts.length };
}

async function handle(request: Request) {
  // Vercel Cron envia `Authorization: Bearer $CRON_SECRET`.
  if (!hasBearerSecret(request, process.env.CRON_SECRET)) {
    return Response.json(
      { error: { code: "unauthorized", message: "Credencial inválida." } },
      { status: 401 },
    );
  }
  try {
    const result = await run();
    console.info("[precos.fornecedor] coleta", result);
    return Response.json({ data: result });
  } catch (error) {
    console.error("[precos.fornecedor] falha na coleta", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json(
      { error: { code: "collect_failed", message: "Coleta indisponível agora." } },
      { status: 503 },
    );
  }
}

export const Route = createFileRoute("/api/precos/fornecedor")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
