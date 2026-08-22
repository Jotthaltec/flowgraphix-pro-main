/**
 * Ponto de entrada do motor de canais de venda.
 *
 * Importar daqui (e não dos arquivos internos) garante que o registro dos
 * adaptadores já rodou — `registry.ts` registra o canal manual na carga.
 */

export * from "./types";
export * from "./registry";
export { manualAdapter, parseManualOrder, PedidoManualInvalido } from "./manual-adapter";
export { podarPayload, VALOR_REDIGIDO } from "./privacy";
