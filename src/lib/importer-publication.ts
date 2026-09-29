/**
 * Destino de um produto importado e o estado de cada item da fila.
 *
 * Regras que a tela do importador e a fila persistente compartilham:
 *   * o destino decide o status do produto no Flow e se ele vai para a loja;
 *   * atualizar um produto existente nunca o reativa sozinho (um arquivado
 *     continua arquivado), a não ser que o usuário peça para publicar;
 *   * uma falha de publicação não desfaz o salvamento no Flow: repetir o item
 *     só repete a publicação, sem reimportar nem duplicar.
 */
import type { ImportItemStatus } from "@/types/importedProduct";
import type { PublishSuccess } from "@/lib/store-publication";

export type SaveDestination = "crm" | "draft" | "publish";

export const SAVE_DESTINATIONS: {
  value: SaveDestination;
  label: string;
  button: string;
  description: string;
}[] = [
  {
    value: "draft",
    label: "Salvar como rascunho (recomendado)",
    button: "Salvar como rascunho",
    description:
      "Entra no Flow como Rascunho para revisar preço, margem e variações antes de ir à loja.",
  },
  {
    value: "crm",
    label: "Salvar apenas no CRM",
    button: "Salvar no CRM",
    description: "Entra no Flow como Ativo, sem publicar na loja.",
  },
  {
    value: "publish",
    label: "Salvar e publicar na Nexus",
    button: "Salvar e publicar na Nexus",
    description:
      "Salva no Flow e publica na loja em seguida, mostrando o resultado de cada produto.",
  },
];

export const DEFAULT_SAVE_DESTINATION: SaveDestination = "draft";

/** Status do produto no Flow ao criar e ao atualizar ("keep" mantém o atual). */
export type ProductStatusRule = { create: "Ativo" | "Rascunho"; update: "Ativo" | "keep" };

export function productStatusRule(destination: SaveDestination): ProductStatusRule {
  switch (destination) {
    case "draft":
      return { create: "Rascunho", update: "keep" };
    case "crm":
      return { create: "Ativo", update: "keep" };
    case "publish":
      return { create: "Ativo", update: "Ativo" };
  }
}

/** Status do item depois de gravado no Flow (antes de uma eventual publicação). */
export function statusAfterSave(
  action: "created" | "updated" | "skipped",
  destination: SaveDestination,
): ImportItemStatus {
  if (action === "skipped") return "ignorado";
  if (destination === "draft") return "rascunho";
  return action === "updated" ? "atualizado" : "importado";
}

export function statusAfterPublish(result: PublishSuccess): ImportItemStatus {
  return result.warnings.length > 0 || result.sync_status === "attention"
    ? "publicado_atencao"
    : "publicado";
}

/** Só publica o que foi de fato gravado: item ignorado não toca a loja. */
export function shouldPublish(
  destination: SaveDestination,
  action: "created" | "updated" | "skipped",
): boolean {
  return destination === "publish" && action !== "skipped";
}

export const FAILED_STATUSES: ImportItemStatus[] = ["erro", "erro_publicacao"];
export const SUCCESS_STATUSES: ImportItemStatus[] = [
  "extraido",
  "pronto_para_importar",
  "importado",
  "atualizado",
  "rascunho",
  "publicado",
  "publicado_atencao",
];
/** Já gravados no Flow: não voltam selecionados ao retomar uma fila. */
export const SAVED_STATUSES: ImportItemStatus[] = [
  "importado",
  "atualizado",
  "rascunho",
  "publicado",
  "publicado_atencao",
  "erro_publicacao",
];

export const isFailedStatus = (s: ImportItemStatus) => FAILED_STATUSES.includes(s);
export const isSavedStatus = (s: ImportItemStatus) => SAVED_STATUSES.includes(s);

export type RetryStep = "analyze" | "save" | "publish";

/**
 * O que repetir num item com erro, retomando do passo que falhou.
 * URL bloqueada não se resolve repetindo, então não entra.
 */
export function retryStep(item: {
  status: ImportItemStatus;
  hasProduct: boolean;
  productId?: string | null;
}): RetryStep | null {
  if (item.status === "erro_publicacao") return item.productId ? "publish" : null;
  if (item.status !== "erro") return null;
  return item.hasProduct ? "save" : "analyze";
}

export const IMPORT_STATUS_LABEL: Record<ImportItemStatus, string> = {
  pendente: "Pendente",
  analisando: "Analisando",
  extraido: "Analisado",
  revisao_necessaria: "Revisar",
  pronto_para_importar: "Pronto",
  importando: "Salvando",
  publicando: "Publicando",
  importado: "Salvo no CRM",
  atualizado: "Atualizado no CRM",
  rascunho: "Rascunho p/ revisão",
  publicado: "Publicado",
  publicado_atencao: "Publicado com atenção",
  ignorado: "Ignorado",
  erro: "Erro",
  erro_publicacao: "Salvo, publicação falhou",
  bloqueado: "Bloqueado",
};

export type RunTally = {
  created: number;
  updated: number;
  skipped: number;
  drafts: number;
  published: number;
  publishedWithWarnings: number;
  failedSave: number;
  failedPublish: number;
};

export const emptyTally = (): RunTally => ({
  created: 0,
  updated: 0,
  skipped: 0,
  drafts: 0,
  published: 0,
  publishedWithWarnings: 0,
  failedSave: 0,
  failedPublish: 0,
});

/** Resumo do lote. Sucesso só quando nada falhou. */
export function summarizeRun(t: RunTally): {
  level: "success" | "warning" | "error";
  message: string;
} {
  const parts = [
    t.created && `${t.created} criado(s)`,
    t.updated && `${t.updated} atualizado(s)`,
    t.drafts && `${t.drafts} como rascunho`,
    t.published && `${t.published} publicado(s) na loja`,
    t.publishedWithWarnings && `${t.publishedWithWarnings} publicado(s) com atenção`,
    t.skipped && `${t.skipped} ignorado(s)`,
    t.failedSave && `${t.failedSave} com erro ao salvar`,
    t.failedPublish && `${t.failedPublish} salvo(s) mas não publicado(s)`,
  ].filter(Boolean);
  const failed = t.failedSave + t.failedPublish;
  const done = t.created + t.updated + t.skipped;
  const level = failed === 0 ? "success" : done === 0 && t.published === 0 ? "error" : "warning";
  const head =
    level === "success"
      ? "Importação concluída"
      : level === "error"
        ? "Nenhum produto foi concluído"
        : "Importação concluída com falhas";
  return { level, message: `${head}: ${parts.join(", ") || "nada a fazer"}.` };
}
