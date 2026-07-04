/**
 * Fase 3 — Vínculo produto ↔ fornecedor.
 *
 * Resolve (encontra ou cria) o registro em `suppliers` correspondente ao
 * domínio do link de origem do produto, para que cada produto importado fique
 * ligado a um fornecedor real (`products.supplier_id`). Esse vínculo é a base
 * da compra assistida (Fase 5): a partir do `supplier_id` chegamos ao perfil de
 * conta (`supplier_accounts`), endereço de entrega e credenciais.
 *
 * Idempotente: nunca duplica fornecedor por domínio dentro da mesma empresa.
 */

import { supabase } from "@/integrations/supabase/client";

/** Nomes canônicos para domínios de fornecedor conhecidos. */
const KNOWN_SUPPLIER_NAMES: Record<string, string> = {
  "futuraim.com.br": "FuturaIM",
};

export function domainFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export interface ResolvedSupplier {
  id: string;
  name: string;
}

/**
 * Encontra ou cria o fornecedor da empresa para o domínio do `sourceUrl`.
 * Retorna `{ id, name }` para gravar em `products.supplier_id`/`supplier_name`,
 * ou `null` se não houver domínio válido.
 */
export async function resolveSupplierByUrl(
  companyId: string,
  sourceUrl?: string | null,
  fallbackName?: string | null,
): Promise<ResolvedSupplier | null> {
  const domain = domainFromUrl(sourceUrl);
  if (!domain) return null;

  // 1. Já existe um fornecedor com este domínio nesta empresa?
  const { data: existing } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("domain", domain)
    .maybeSingle();
  if (existing?.id) return { id: existing.id, name: existing.name };

  // 2. Cria o fornecedor (find-or-create).
  const name = KNOWN_SUPPLIER_NAMES[domain] || fallbackName || domain;
  const { data: created, error } = await supabase
    .from("suppliers")
    .insert({
      company_id: companyId,
      name,
      domain,
      website_url: `https://${domain}`,
      status: "Ativo",
    })
    .select("id, name")
    .single();
  if (!error && created?.id) return { id: created.id, name: created.name };

  // 3. Corrida/conflito de unicidade: tenta reler antes de desistir.
  const { data: retry } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("domain", domain)
    .maybeSingle();
  return retry?.id ? { id: retry.id, name: retry.name } : null;
}
