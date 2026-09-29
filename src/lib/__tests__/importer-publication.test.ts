import { describe, expect, it } from "vitest";
import {
  DEFAULT_SAVE_DESTINATION,
  IMPORT_STATUS_LABEL,
  SAVE_DESTINATIONS,
  emptyTally,
  isSavedStatus,
  productStatusRule,
  retryStep,
  shouldPublish,
  statusAfterPublish,
  statusAfterSave,
  summarizeRun,
} from "@/lib/importer-publication";
import type { PublishSuccess } from "@/lib/store-publication";

const published: PublishSuccess = {
  ok: true,
  action: "insert",
  product_id: "p1",
  slug: "cartao-p1",
  sync_status: "synced",
  sync_version: 1,
  content_hash: "h",
  counts: { images: 1, option_groups: 0, options: 0, variants: 1, tiers: 1 },
  warnings: [],
};

describe("destinos", () => {
  it("oferece as três opções, com rascunho como padrão recomendado", () => {
    expect(SAVE_DESTINATIONS.map((d) => d.value).sort()).toEqual(["crm", "draft", "publish"]);
    expect(DEFAULT_SAVE_DESTINATION).toBe("draft");
    expect(SAVE_DESTINATIONS.find((d) => d.value === "draft")!.label).toMatch(/recomendado/);
  });

  it("rascunho cria como Rascunho e nunca rebaixa um produto existente", () => {
    expect(productStatusRule("draft")).toEqual({ create: "Rascunho", update: "keep" });
  });

  it("salvar no CRM não reativa produto existente (ex.: arquivado)", () => {
    expect(productStatusRule("crm")).toEqual({ create: "Ativo", update: "keep" });
  });

  it("publicar é pedido explícito: deixa o produto Ativo", () => {
    expect(productStatusRule("publish")).toEqual({ create: "Ativo", update: "Ativo" });
  });
});

describe("status do item", () => {
  it("depois de salvar", () => {
    expect(statusAfterSave("created", "draft")).toBe("rascunho");
    expect(statusAfterSave("updated", "draft")).toBe("rascunho");
    expect(statusAfterSave("created", "crm")).toBe("importado");
    expect(statusAfterSave("updated", "publish")).toBe("atualizado");
    expect(statusAfterSave("skipped", "publish")).toBe("ignorado");
  });

  it("depois de publicar distingue publicado de publicado com atenção", () => {
    expect(statusAfterPublish(published)).toBe("publicado");
    expect(statusAfterPublish({ ...published, warnings: ["Produto sem imagem publica."] })).toBe(
      "publicado_atencao",
    );
    expect(statusAfterPublish({ ...published, sync_status: "attention" })).toBe(
      "publicado_atencao",
    );
  });

  it("só publica o que foi gravado, e só quando pedido", () => {
    expect(shouldPublish("publish", "created")).toBe(true);
    expect(shouldPublish("publish", "updated")).toBe(true);
    expect(shouldPublish("publish", "skipped")).toBe(false);
    expect(shouldPublish("draft", "created")).toBe(false);
    expect(shouldPublish("crm", "updated")).toBe(false);
  });

  it("itens já gravados não voltam selecionados ao retomar a fila", () => {
    for (const s of ["importado", "rascunho", "publicado", "erro_publicacao"] as const) {
      expect(isSavedStatus(s)).toBe(true);
    }
    for (const s of ["extraido", "revisao_necessaria", "erro"] as const) {
      expect(isSavedStatus(s)).toBe(false);
    }
  });

  it("todo status tem rótulo", () => {
    expect(Object.values(IMPORT_STATUS_LABEL).every((l) => l.length > 0)).toBe(true);
  });
});

describe("retryStep", () => {
  it("falha de publicação repete só a publicação — nunca reimporta", () => {
    expect(retryStep({ status: "erro_publicacao", hasProduct: true, productId: "p1" })).toBe(
      "publish",
    );
    expect(retryStep({ status: "erro_publicacao", hasProduct: true, productId: null })).toBeNull();
  });

  it("falha ao salvar repete a gravação; falha de análise repete a análise", () => {
    expect(retryStep({ status: "erro", hasProduct: true })).toBe("save");
    expect(retryStep({ status: "erro", hasProduct: false })).toBe("analyze");
  });

  it("não repete o que não falhou nem URL bloqueada", () => {
    expect(retryStep({ status: "bloqueado", hasProduct: false })).toBeNull();
    expect(retryStep({ status: "publicado", hasProduct: true, productId: "p1" })).toBeNull();
    expect(retryStep({ status: "rascunho", hasProduct: true, productId: "p1" })).toBeNull();
  });
});

describe("summarizeRun", () => {
  it("sucesso só quando nada falhou", () => {
    const r = summarizeRun({ ...emptyTally(), created: 2, published: 2 });
    expect(r.level).toBe("success");
    expect(r.message).toContain("2 criado(s)");
    expect(r.message).toContain("2 publicado(s) na loja");
  });

  it("falha parcial vira aviso e é contada", () => {
    const r = summarizeRun({ ...emptyTally(), created: 3, published: 2, failedPublish: 1 });
    expect(r.level).toBe("warning");
    expect(r.message).toContain("1 salvo(s) mas não publicado(s)");
  });

  it("tudo falhou é erro, nunca sucesso", () => {
    const r = summarizeRun({ ...emptyTally(), failedSave: 2 });
    expect(r.level).toBe("error");
    expect(r.message).toMatch(/Nenhum produto/);
  });

  it("repetição que só publica conta como concluída", () => {
    expect(summarizeRun({ ...emptyTally(), published: 1 }).level).toBe("success");
  });
});
