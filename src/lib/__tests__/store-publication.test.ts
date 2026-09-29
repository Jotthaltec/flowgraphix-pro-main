import { describe, expect, it, vi } from "vitest";
import {
  PublishError,
  describePublishSuccess,
  parsePublishResult,
  publishCrmProduct,
  storeProductUrl,
  type PublishSuccess,
} from "@/lib/store-publication";

const success: PublishSuccess = {
  ok: true,
  action: "update",
  product_id: "487992ba-fc32-4231-8c27-7242539658d8",
  sync_status: "synced",
  sync_version: 3,
  content_hash: "abc",
  counts: { images: 4, option_groups: 7, options: 17, variants: 13, tiers: 10 },
  warnings: [],
};

function clientReturning(data: unknown, error: { message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  const schema = vi.fn().mockReturnValue({ rpc });
  return { client: { schema }, schema, rpc };
}

describe("publishCrmProduct", () => {
  it("chama a publicação canônica no schema store", async () => {
    const { client, schema, rpc } = clientReturning(success);
    await expect(publishCrmProduct(client, "crm-1")).resolves.toEqual(success);
    expect(schema).toHaveBeenCalledWith("store");
    expect(rpc).toHaveBeenCalledWith("publish_crm_product", { p_crm_product_id: "crm-1" });
  });

  it("trata ok:false como falha, mesmo sem erro do Supabase", async () => {
    const failure = {
      ok: false,
      action: "error",
      product_id: "p1",
      sync_status: "error",
      error: "Defina a categoria do produto antes de publicar.",
      code: "22023",
      content_hash: "abc",
      warnings: [],
    };
    const { client } = clientReturning(failure);
    const promise = publishCrmProduct(client, "crm-1");
    await expect(promise).rejects.toBeInstanceOf(PublishError);
    await expect(promise).rejects.toThrow("Defina a categoria");
    await promise.catch((err: PublishError) => expect(err.result?.code).toBe("22023"));
  });

  it("propaga erro da chamada", async () => {
    const { client } = clientReturning(null, {
      message: "Sem permissao para publicar este produto.",
    });
    await expect(publishCrmProduct(client, "crm-1")).rejects.toThrow("Sem permissao");
  });

  it("nunca confirma sucesso com resposta fora do formato", async () => {
    const { client } = clientReturning({ id: "x", action: "update" });
    await expect(publishCrmProduct(client, "crm-1")).rejects.toThrow("resposta inesperada");
    expect(() => parsePublishResult(null)).toThrow(PublishError);
    expect(() => parsePublishResult({ ok: true, action: "insert" })).toThrow("sem identificar");
  });
});

describe("describePublishSuccess", () => {
  it("diferencia criação, atualização e noop", () => {
    expect(describePublishSuccess({ ...success, action: "insert" }).title).toMatch(/publicado/);
    expect(describePublishSuccess(success).title).toMatch(/atualizado/);
    expect(describePublishSuccess({ ...success, action: "noop" }).title).toMatch(
      /nada foi alterado/,
    );
  });

  it("mostra contagens e rebaixa para aviso quando há warnings", () => {
    const ok = describePublishSuccess(success);
    expect(ok.level).toBe("success");
    expect(ok.description).toContain(
      "4 mídia(s), 7 grupo(s), 17 opção(ões), 13 variante(s) e 10 tiragem(ns).",
    );
    const warned = describePublishSuccess({
      ...success,
      warnings: ["Produto sem imagem publica."],
    });
    expect(warned.level).toBe("warning");
    expect(warned.description).toContain("Produto sem imagem publica.");
  });
});

describe("storeProductUrl", () => {
  it("aponta para a rota de produto da loja", () => {
    expect(storeProductUrl("https://nexusprinti.com.br/", "cartao-de-visita-21ed9d14")).toBe(
      "https://nexusprinti.com.br/produtos/cartao-de-visita-21ed9d14",
    );
  });
});
