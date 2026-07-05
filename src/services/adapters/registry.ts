/**
 * Registro e resolução de adaptadores de fornecedor (§3, §6).
 *
 * A escolha do adaptador é por PONTUAÇÃO: pega o maior `matchScore` acima de
 * zero; empates são desempatados priorizando o adaptador ESPECÍFICO do domínio
 * sobre os genéricos. Assim, adicionar suporte a um novo fornecedor é registrar
 * um novo adaptador — nada mais no importador muda.
 */

import type { AdapterMatch, AdapterMatchContext, SupplierAdapter } from "./types";
import { isGenericAdapter } from "./types";

const registry = new Map<string, SupplierAdapter>();

/** Registra (ou substitui) um adaptador pela sua chave. */
export function registerAdapter(adapter: SupplierAdapter): void {
  registry.set(adapter.key, adapter);
}

/** Remove um adaptador (útil em testes). */
export function unregisterAdapter(key: string): void {
  registry.delete(key);
}

/** Lista todos os adaptadores registrados. */
export function getAdapters(): SupplierAdapter[] {
  return Array.from(registry.values());
}

/** Busca um adaptador pela chave. */
export function getAdapter(key: string): SupplierAdapter | undefined {
  return registry.get(key);
}

/**
 * Avalia todos os adaptadores contra a página e devolve os candidatos ordenados
 * do mais provável para o menos provável (score desc; específico > genérico).
 */
export function rankAdapters(ctx: AdapterMatchContext): AdapterMatch[] {
  const matches: AdapterMatch[] = [];
  for (const adapter of registry.values()) {
    const { score, reason } = adapter.matchScore(ctx);
    if (score > 0) matches.push({ adapter, score, reason });
  }
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Desempate: específico do domínio vence o genérico.
    const ag = isGenericAdapter(a.adapter) ? 1 : 0;
    const bg = isGenericAdapter(b.adapter) ? 1 : 0;
    return ag - bg;
  });
  return matches;
}

/**
 * Resolve o melhor adaptador para uma página, ou `null` se nenhum se aplica.
 * `preferKey` (ex.: adapter_key do perfil aprovado) tem prioridade se casar (>0):
 * o motor NÃO reaprende o site a cada sync — reutiliza o perfil (§5).
 */
export function resolveAdapter(
  ctx: AdapterMatchContext,
  preferKey?: string,
): AdapterMatch | null {
  if (preferKey) {
    const preferred = registry.get(preferKey);
    if (preferred) {
      const { score, reason } = preferred.matchScore(ctx);
      if (score > 0) {
        return { adapter: preferred, score, reason: `perfil aprovado: ${reason}` };
      }
    }
  }
  const ranked = rankAdapters(ctx);
  return ranked[0] ?? null;
}
