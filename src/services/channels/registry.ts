/**
 * Registro de adaptadores de canal.
 *
 * Aqui a resolução é DIRETA pelo `provider`, e não por pontuação como no motor
 * de fornecedores (`src/services/adapters/registry.ts`): lá o sistema descobre
 * sozinho que tecnologia a página do fornecedor usa; aqui o canal foi escolhido
 * pelo usuário quando ele conectou a conta. Não há nada a adivinhar.
 */

import type { ChannelAdapter, ChannelProvider } from "./types";
import { manualAdapter } from "./manual-adapter";

const registry = new Map<ChannelProvider, ChannelAdapter>();

/** Registra (ou substitui) um adaptador. */
export function registerChannelAdapter(adapter: ChannelAdapter): void {
  registry.set(adapter.provider, adapter);
}

/** Remove um adaptador (útil em testes). */
export function unregisterChannelAdapter(provider: ChannelProvider): void {
  registry.delete(provider);
}

/** Lista os adaptadores disponíveis — alimenta o seletor de canal na tela. */
export function getChannelAdapters(): ChannelAdapter[] {
  return Array.from(registry.values());
}

/**
 * Resolve o adaptador de um provedor. Lança em vez de devolver `undefined`:
 * um job na fila apontando para provedor desconhecido é defeito, não caso
 * normal, e precisa aparecer no log em vez de virar `no-op`.
 */
export function getChannelAdapter(provider: string): ChannelAdapter {
  const adapter = registry.get(provider as ChannelProvider);
  if (!adapter) {
    throw new Error(
      `Canal desconhecido: "${provider}". Registrados: ${[...registry.keys()].join(", ") || "nenhum"}.`,
    );
  }
  return adapter;
}

// O canal manual é registrado na carga do módulo porque não depende de
// configuração nenhuma — é o que garante que o módulo funciona de ponta a ponta
// antes de qualquer credencial de marketplace existir.
registerChannelAdapter(manualAdapter);
