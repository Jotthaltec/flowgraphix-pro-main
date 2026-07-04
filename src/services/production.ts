import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export async function generateProductionOrderFromQuote(quoteId: string, companyId: string, profileId: string) {
  // 1. Verifica se já existe OP (Idempotência)
  const { data: existingOP } = await (db)
    .from("production_orders")
    .select("id, order_number")
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (existingOP) {
    return { alreadyExisted: true, order_number: existingOP.order_number, id: existingOP.id };
  }

  // 2. Busca o orçamento e os itens (incluindo atributos escolhidos na venda)
  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select("client_id, deadline, notes")
    .eq("id", quoteId)
    .single();

  if (qErr || !quote) throw new Error("Orçamento não encontrado.");

  const { data: quoteItems, error: qiErr } = await supabase
    .from("quote_items")
    .select("*")
    .eq("quote_id", quoteId);

  if (qiErr || !quoteItems || quoteItems.length === 0) {
    throw new Error("Orçamento não possui itens para produzir.");
  }

  // 3. Cria o Cabeçalho da OP
  const { data: newOP, error: opErr } = await (db)
    .from("production_orders")
    .insert([{
      company_id: companyId,
      quote_id: quoteId,
      client_id: quote.client_id,
      status: "aprovado",
      expected_delivery: quote.deadline,
      notes: quote.notes,
      created_by: profileId
    }])
    .select("id, order_number")
    .single();

  if (opErr || !newOP) throw new Error("Falha ao criar cabeçalho da OP: " + opErr?.message);

  // 4. Mapear e criar os itens da OP
  const productionItemsData = quoteItems.map(item => ({
    production_order_id: newOP.id,
    product_id: item.product_service_id,
    quantity: item.quantity || 1,
    status: "aguardando"
  }));

  const { data: insertedItems, error: itemsErr } = await (db)
    .from("production_order_items")
    .insert(productionItemsData)
    .select("id, product_id");

  if (itemsErr || !insertedItems) throw new Error("Falha ao criar itens da OP: " + itemsErr?.message);

  // 5. Para cada item, gerar etapas padrão
  const stepsData: any[] = [];
  insertedItems.forEach((pItem: any) => {
    const defaultSteps = [
      { step_name: "Arte e Aprovação", order_index: 1 },
      { step_name: "Pré-impressão", order_index: 2 },
      { step_name: "Impressão", order_index: 3 },
      { step_name: "Acabamento", order_index: 4 },
      { step_name: "Conferência e Expedição", order_index: 5 }
    ];
    defaultSteps.forEach(step => {
      stepsData.push({
        production_order_item_id: pItem.id,
        step_name: step.step_name,
        order_index: step.order_index,
        status: "pendente"
      });
    });
  });

  if (stepsData.length > 0) {
    await (db).from("production_steps").insert(stepsData);
  }

  // 6. NOVO: Transferir atributos do orçamento para a ficha técnica da produção
  // Busca os atributos técnicos para resolver code -> id
  const { data: techAttrs } = await (db)
    .from("technical_attributes")
    .select("id, code");

  const attrCodeToId: Record<string, string> = {};
  (techAttrs || []).forEach((a: any) => { attrCodeToId[a.code] = a.id; });

  const attrInserts: any[] = [];
  quoteItems.forEach((qItem: any, idx: number) => {
    const pItem = insertedItems[idx];
    if (!pItem) return;

    // Ler item_attributes JSONB do quote_item
    const itemAttrs = qItem.item_attributes;
    if (itemAttrs && itemAttrs.values && typeof itemAttrs.values === 'object') {
      Object.entries(itemAttrs.values).forEach(([code, value]) => {
        const attrId = attrCodeToId[code];
        if (attrId && value !== undefined && value !== null && value !== "") {
          attrInserts.push({
            production_order_item_id: pItem.id,
            attribute_id: attrId,
            value: String(value)
          });
        }
      });
    }
  });

  if (attrInserts.length > 0) {
    await (db).from("production_item_attributes").insert(attrInserts);
  }

  // 7. Registro no Histórico
  await (db).from("production_history").insert([{
    production_order_id: newOP.id,
    action: "OP Criada",
    notes: `Criada automaticamente após aprovação do orçamento. ${attrInserts.length} atributo(s) técnico(s) transferidos da venda.`,
    actor_id: profileId
  }]);

  return { alreadyExisted: false, order_number: newOP.order_number, id: newOP.id };
}
