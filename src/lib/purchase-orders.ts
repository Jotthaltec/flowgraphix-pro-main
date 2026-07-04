/**
 * Fase 4 — Geração de pedidos de compra ao fornecedor.
 *
 * A partir de um pedido do cliente (orders) recém-criado e do orçamento de
 * origem, gera um pedido de compra (purchase_orders) POR FORNECEDOR, agrupando
 * os itens do orçamento vinculados a fornecedor (Fase 3: products.supplier_id).
 *
 * Cada PO captura um snapshot do destino (modo de recebimento + endereço),
 * combinando os dados da gráfica (Fase 1 — companies) com o perfil de conta no
 * fornecedor (Fase 2 — supplier_accounts). Cada item guarda o `source_url` do
 * fornecedor — insumo direto da compra assistida (Fase 5).
 *
 * Idempotente por pedido: não duplica se já houver PO para o mesmo order_id.
 */

import { supabase } from "@/integrations/supabase/client";

export interface DeliverySnapshot {
  receiving_mode: string | null;
  recipient?: string | null;
  zip?: string | null;
  address?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  pickup_point?: string | null;
}

/** Resolve o modo de recebimento e o endereço/retirada para um fornecedor. */
function buildDeliverySnapshot(
  company: Record<string, any> | null,
  account: Record<string, any> | null,
): { receiving_mode: string; snapshot: DeliverySnapshot } {
  const receiving_mode = account?.receiving_mode || company?.default_receiving_mode || "delivery";

  if (receiving_mode === "pickup") {
    return {
      receiving_mode,
      snapshot: {
        receiving_mode,
        pickup_point: account?.preferred_pickup_point || company?.preferred_pickup_point || null,
      },
    };
  }

  // delivery — conta com override usa o endereço da própria conta.
  if (account?.delivery_override) {
    return {
      receiving_mode,
      snapshot: {
        receiving_mode,
        recipient: account.delivery_recipient || company?.name || null,
        zip: account.delivery_zip || null,
        address: account.delivery_address || null,
        number: account.delivery_number || null,
        complement: account.delivery_complement || null,
        neighborhood: account.delivery_neighborhood || null,
        city: account.delivery_city || null,
        state: account.delivery_state || null,
        phone: account.delivery_phone || null,
      },
    };
  }

  // delivery — endereço da gráfica (entrega própria ou, se não houver, o fiscal).
  const sameAsFiscal = company?.delivery_same_as_fiscal !== false;
  return {
    receiving_mode,
    snapshot: {
      receiving_mode,
      recipient: company?.delivery_recipient || company?.name || null,
      zip: (sameAsFiscal ? company?.zip_code : company?.delivery_zip) || company?.delivery_zip || company?.zip_code || null,
      address: (sameAsFiscal ? company?.address : company?.delivery_address) || company?.delivery_address || company?.address || null,
      number: (sameAsFiscal ? company?.address_number : company?.delivery_number) || company?.delivery_number || null,
      complement: (sameAsFiscal ? company?.complement : company?.delivery_complement) || null,
      neighborhood: (sameAsFiscal ? company?.neighborhood : company?.delivery_neighborhood) || null,
      city: company?.delivery_city || null,
      state: company?.delivery_state || null,
      phone: company?.delivery_phone || company?.phone || null,
    },
  };
}

export interface GeneratePOResult {
  created: number;
  poIds: string[];
  message?: string;
}

export async function createPurchaseOrdersForOrder(params: {
  companyId: string;
  quoteId: string;
  orderId: string;
}): Promise<GeneratePOResult> {
  const { companyId, quoteId, orderId } = params;

  // Não duplica: se já há PO para este pedido, não gera de novo.
  const { data: existing } = await supabase
    .from("purchase_orders")
    .select("id")
    .eq("order_id", orderId)
    .limit(1);
  if (existing && existing.length) {
    return { created: 0, poIds: [], message: "Pedido de compra já existe para este pedido." };
  }

  // Itens do orçamento vinculados a fornecedor (Fase 3).
  const { data: items, error: itemsErr } = await supabase
    .from("quote_items")
    .select("*")
    .eq("quote_id", quoteId);
  if (itemsErr) throw itemsErr;

  const supplierItems = (items || []).filter((it) => it.supplier_id);
  if (!supplierItems.length) {
    return { created: 0, poIds: [], message: "Nenhum item vinculado a fornecedor neste pedido." };
  }

  // Dados dos produtos (source_url/supplier_sku) para a compra assistida.
  const productIds = [...new Set(supplierItems.map((it) => it.product_service_id).filter(Boolean))] as string[];
  const productsById: Record<string, any> = {};
  if (productIds.length) {
    const { data: prods } = await supabase
      .from("products")
      .select("id, source_url, supplier_sku, name")
      .in("id", productIds);
    (prods || []).forEach((p) => {
      productsById[p.id] = p;
    });
  }

  // Empresa (endereço/recebimento — Fase 1).
  const { data: company } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();

  // Agrupa por fornecedor.
  const groups = new Map<string, typeof supplierItems>();
  for (const it of supplierItems) {
    const sid = it.supplier_id as string;
    if (!groups.has(sid)) groups.set(sid, []);
    groups.get(sid)!.push(it);
  }

  // Numeração sequencial PC-000000.
  const { count } = await supabase.from("purchase_orders").select("*", { count: "exact", head: true });
  let seq = count || 0;
  const poIds: string[] = [];

  for (const [supplierId, groupItems] of groups) {
    // Perfil de conta no fornecedor (Fase 2) — snapshot e credenciais.
    const { data: account } = await supabase
      .from("supplier_accounts_safe")
      .select("*")
      .eq("company_id", companyId)
      .eq("supplier_id", supplierId)
      .maybeSingle();

    const { receiving_mode, snapshot } = buildDeliverySnapshot(company, account);
    const totalCost = groupItems.reduce(
      (sum, it) => sum + (Number(it.cost_price) || 0) * (Number(it.quantity) || 1),
      0,
    );

    seq += 1;
    const poNumber = `PC-${String(seq).padStart(6, "0")}`;

    const { data: po, error: poErr } = await supabase
      .from("purchase_orders")
      .insert({
        company_id: companyId,
        supplier_id: supplierId,
        supplier_account_id: (account as any)?.id ?? null,
        order_id: orderId,
        quote_id: quoteId,
        po_number: poNumber,
        status: "rascunho",
        receiving_mode,
        delivery_snapshot: snapshot as unknown as Record<string, unknown>,
        total_cost: parseFloat(totalCost.toFixed(2)),
      })
      .select("id")
      .single();
    if (poErr) throw poErr;

    const poItems = groupItems.map((it) => {
      const prod = it.product_service_id ? productsById[it.product_service_id] : null;
      const qty = Number(it.quantity) || 1;
      const unit = Number(it.cost_price) || 0;
      return {
        purchase_order_id: po.id,
        product_id: it.product_service_id ?? null,
        quote_item_id: it.id,
        product_name: it.item_name || prod?.name || "Item",
        source_url: prod?.source_url ?? null,
        supplier_sku: prod?.supplier_sku ?? null,
        quantity: qty,
        unit_cost: unit,
        total_cost: parseFloat((unit * qty).toFixed(2)),
      };
    });
    const { error: itErr } = await supabase.from("purchase_order_items").insert(poItems);
    if (itErr) throw itErr;

    poIds.push(po.id);
  }

  return { created: poIds.length, poIds };
}
