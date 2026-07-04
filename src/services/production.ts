import { supabase } from "@/integrations/supabase/client";

export async function generateProductionOrderFromQuote(quoteId: string, companyId: string, profileId: string) {
  // 1. Verifica se já existe OP (Idempotência)
  const { data: existingOP } = await supabase
    .from("production_orders")
    .select("id, order_number")
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (existingOP) {
    return { alreadyExisted: true, order_number: existingOP.order_number, id: existingOP.id };
  }

  // 2. Busca o orçamento e os itens
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

  // 3. Cria o Cabeçalho da OP (Gatilho no banco gera o order_number automaticamente)
  const { data: newOP, error: opErr } = await supabase
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

  // 4. Mapear e criar os itens da OP e Etapas Padrão
  const productionItemsData = quoteItems.map(item => ({
    production_order_id: newOP.id,
    product_id: item.product_service_id,
    quantity: item.quantity || 1,
    status: "aguardando"
  }));

  const { data: insertedItems, error: itemsErr } = await supabase
    .from("production_order_items")
    .insert(productionItemsData)
    .select("id, product_id");

  if (itemsErr || !insertedItems) throw new Error("Falha ao criar itens da OP: " + itemsErr?.message);

  // 5. Para cada item, gerar as etapas (Arte, Pré-impressão, Impressão, Acabamento, Expedição)
  // Num cenário avançado, leríamos de um template do product_model_id, mas vamos gerar um fluxo universal.
  const stepsData: any[] = [];
  insertedItems.forEach((pItem) => {
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
    await supabase.from("production_steps").insert(stepsData);
  }

  // 6. Registro no Histórico
  await supabase.from("production_history").insert([{
    production_order_id: newOP.id,
    action: "OP Criada",
    notes: `Criada automaticamente após aprovação do orçamento.`,
    actor_id: profileId
  }]);

  return { alreadyExisted: false, order_number: newOP.order_number, id: newOP.id };
}
