/**
 * MOTOR UNIVERSAL DE FORNECEDORES — contrato dos adaptadores.
 *
 * Um `SupplierAdapter` é o que torna o importador GENÉRICO em vez de preso à
 * FuturaIM: cada tecnologia de site (FuturaIM, JSON-LD genérico, e-commerce
 * genérico, feed, conector) implementa a mesma interface e produz o modelo
 * canônico `ImportedProduct`. A resolução de qual adaptador usar é feita por
 * pontuação (`matchScore`), priorizando o adaptador específico do domínio sobre
 * os genéricos (§3, §6 da spec).
 *
 * Regras de projeto:
 *  - Adaptadores são PUROS (recebem HTML/url, devolvem dados) — sem I/O de rede,
 *    sem Supabase. Toda a raspagem segura (anti-SSRF) continua nas server fns.
 *  - Nenhum adaptador fabrica dados: campo sem evidência fica vazio + warning.
 */

import type { ImportedProduct } from "@/types/importedProduct";

/** Contexto usado para decidir qual adaptador roda uma página. */
export interface AdapterMatchContext {
  /** URL da página (já validada pela server fn). */
  url: string;
  /** Domínio sem `www.` (ex.: "futuraim.com.br"). */
  domain: string;
  /** HTML da página, quando disponível — permite detectar JSON-LD/tecnologia. */
  html?: string;
}

/** Resultado de uma tentativa de casar adaptador → página. */
export interface AdapterMatch {
  adapter: SupplierAdapter;
  /** 0..1 — confiança de que este adaptador consegue interpretar a página. */
  score: number;
  /** Motivo legível da pontuação (auditoria/§4 confiança). */
  reason: string;
}

/**
 * Contrato que todo adaptador de fornecedor implementa.
 */
export interface SupplierAdapter {
  /** Chave estável usada em `supplier_mapping_profiles.adapter_key`. */
  key: string;
  /** Nome legível para UI. */
  label: string;
  /**
   * Domínios para os quais este adaptador é ESPECÍFICO. Vazio = adaptador
   * genérico (fallback), que só vence quando nenhum específico casa.
   */
  domains: string[];
  /**
   * Pontua 0..1 a capacidade de interpretar a página. > 0 significa "consigo
   * tentar". Deve ser barato: olha domínio + sinais no HTML, não faz parse
   * completo.
   */
  matchScore(ctx: AdapterMatchContext): { score: number; reason: string };
  /**
   * Interpreta uma página de PRODUTO no modelo canônico. Lança apenas em erro
   * irrecuperável; problemas parciais viram `warnings`/`errors` no resultado.
   */
  parseProduct(html: string, url: string): ImportedProduct;
}

/** true quando o adaptador é genérico (fallback, sem domínio específico). */
export function isGenericAdapter(a: SupplierAdapter): boolean {
  return a.domains.length === 0;
}
