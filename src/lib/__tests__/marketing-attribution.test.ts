import { describe, expect, it } from "vitest";
import { summarizeOrderOrigin, type OrderAttributionRow } from "@/lib/marketing-attribution";

const row = (over: Partial<OrderAttributionRow>): OrderAttributionRow => ({
  channel: "paid_social",
  utm_source: "facebook",
  utm_campaign: "cartao-visita-set",
  status: "active",
  is_primary: true,
  source: "auto",
  ...over,
});

describe("summarizeOrderOrigin", () => {
  it("pedido sem atribuição (não pago) não mostra origem", () => {
    expect(summarizeOrderOrigin([])).toBeNull();
    expect(summarizeOrderOrigin(null)).toBeNull();
  });

  it("usa só o modelo principal", () => {
    const origin = summarizeOrderOrigin([
      row({ is_primary: false, channel: "organic_social", utm_campaign: "bio" }),
      row({}),
    ]);
    expect(origin).toEqual({
      label: "Anúncio (redes)",
      detail: "cartao-visita-set",
      reversed: false,
      manual: false,
    });
  });

  it("direto não exibe campanha; estorno e correção manual ficam sinalizados", () => {
    expect(
      summarizeOrderOrigin([row({ channel: "direct", utm_campaign: null, utm_source: null })])
        ?.detail,
    ).toBeNull();
    const origin = summarizeOrderOrigin([row({ status: "reversed", source: "manual" })]);
    expect(origin?.reversed).toBe(true);
    expect(origin?.manual).toBe(true);
  });

  it("canal desconhecido não quebra a tela", () => {
    expect(summarizeOrderOrigin([row({ channel: "novo_canal" })])?.label).toBe("Outra origem");
  });
});
