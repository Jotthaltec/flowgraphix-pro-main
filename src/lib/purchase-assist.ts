/**
 * Fase 5 — Compra assistida.
 *
 * Helpers PUROS (sem I/O) para montar o "checklist de compra" que o operador
 * segue no site do fornecedor: um texto único, copiável, com a conta, o destino
 * e a lista de itens (com link, quantidade, SKU e custo). Toda a persistência e
 * leitura de credenciais fica fora daqui — este módulo só formata.
 */

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export interface ChecklistItem {
  product_name: string;
  source_url?: string | null;
  supplier_sku?: string | null;
  quantity: number;
  unit_cost: number;
}

export interface ChecklistAccount {
  login_username?: string | null;
  registration_cnpj?: string | null;
  registration_email?: string | null;
  has_password?: boolean | null;
}

export interface ChecklistDelivery {
  receiving_mode?: string | null;
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

export interface ChecklistInput {
  poNumber: string;
  supplierName?: string | null;
  supplierUrl?: string | null;
  account?: ChecklistAccount | null;
  delivery?: ChecklistDelivery | null;
  items: ChecklistItem[];
}

/** Total estimado dos itens (quantidade × custo unitário). */
export function checklistTotal(items: ChecklistItem[]): number {
  return items.reduce((sum, it) => sum + (Number(it.unit_cost) || 0) * (Number(it.quantity) || 0), 0);
}

/** Endereço/retirada em texto de uma ou mais linhas (para copiar/colar). */
export function formatDeliveryText(d?: ChecklistDelivery | null): string {
  if (!d) return "Destino não informado.";
  if (d.receiving_mode === "pickup") {
    return `Retirada: ${d.pickup_point || "ponto não definido"}`;
  }
  const lines: string[] = [];
  if (d.recipient) lines.push(d.recipient);
  const street = [d.address, d.number].filter(Boolean).join(", ");
  if (street) lines.push(d.complement ? `${street} — ${d.complement}` : street);
  const region = [d.neighborhood, d.city, d.state].filter(Boolean).join(" · ");
  if (region) lines.push(region);
  if (d.zip) lines.push(`CEP ${d.zip}`);
  if (d.phone) lines.push(`Tel. ${d.phone}`);
  return lines.length ? lines.join("\n") : "Endereço não informado.";
}

/**
 * Monta o checklist de compra completo em texto simples, pronto para copiar.
 */
export function buildPurchaseChecklist(input: ChecklistInput): string {
  const { poNumber, supplierName, supplierUrl, account, delivery, items } = input;
  const out: string[] = [];

  out.push(`PEDIDO DE COMPRA ${poNumber}`);
  if (supplierName) out.push(`Fornecedor: ${supplierName}`);
  if (supplierUrl) out.push(`Site: ${supplierUrl}`);

  // Conta
  if (account && (account.login_username || account.registration_cnpj || account.registration_email)) {
    out.push("", "— CONTA —");
    if (account.login_username) out.push(`Login: ${account.login_username}`);
    if (account.has_password) out.push("Senha: (salva no perfil — use o gerenciador de senhas)");
    if (account.registration_cnpj) out.push(`CNPJ: ${account.registration_cnpj}`);
    if (account.registration_email) out.push(`E-mail: ${account.registration_email}`);
  }

  // Destino
  out.push("", "— DESTINO —", formatDeliveryText(delivery));

  // Itens
  out.push("", `— ITENS (${items.length}) —`);
  items.forEach((it, i) => {
    const sku = it.supplier_sku ? ` · SKU ${it.supplier_sku}` : "";
    out.push(
      `${i + 1}. ${it.product_name} — ${it.quantity} un × ${brl(it.unit_cost)}${sku}`,
    );
    if (it.source_url) out.push(`   ${it.source_url}`);
  });

  out.push("", `TOTAL ESTIMADO: ${brl(checklistTotal(items))}`);
  return out.join("\n");
}
