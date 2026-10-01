import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { createCampaignCopyGenerator, type ProductFacts } from "../openai.server";
import { renderCampaign, wrapText } from "../render.server";

const facts: ProductFacts = {
  name: "Cartão de visita",
  shortDescription: "Cartão em papel couché",
  description: null,
  benefits: ["Boa apresentação"],
  materials: ["Couché"],
  applications: ["Contato comercial"],
  price: 1.14,
  priceUnit: "unidade",
  minQuantity: 50,
  productionDays: 4,
  onSale: false,
};

const copy = {
  eyebrow: "Produto da semana",
  headline: "Seu primeiro contato merece ser lembrado",
  supporting_line: "Apresente sua marca com confiança.",
  cta: "Peça seu orçamento",
  caption: "Sua marca começa antes da conversa.",
  hashtags: ["#NexusPrinti", "#CartaoDeVisita", "#Impressao"],
};

describe("campanha social de novo produto", () => {
  it("valida a resposta estruturada da OpenAI", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body));
      expect(sent.text.format.type).toBe("json_schema");
      expect(sent.input[1].content).toContain("Cartão de visita");
      return new Response(
        JSON.stringify({
          output: [
            { type: "message", content: [{ type: "output_text", text: JSON.stringify(copy) }] },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const result = await createCampaignCopyGenerator({ apiKey: "test", fetchImpl })(facts);
    expect(result).toEqual(copy);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("gera feed e Story exatamente nas dimensões aprovadas", async () => {
    const productImage = await sharp({
      create: { width: 900, height: 700, channels: 3, background: "#7300ff" },
    })
      .png()
      .toBuffer();
    const result = await renderCampaign({
      copy,
      product: facts,
      productImage,
      productImageMime: "image/png",
    });
    await expect(sharp(result.feed).metadata()).resolves.toMatchObject({
      width: 1080,
      height: 1350,
      format: "png",
    });
    await expect(sharp(result.story).metadata()).resolves.toMatchObject({
      width: 1080,
      height: 1920,
      format: "png",
    });
  });

  it("limita títulos longos sem estourar a área segura", () => {
    expect(
      wrapText("um título bastante longo para validar a quebra de linha centralizada", 16, 3),
    ).toHaveLength(3);
  });
});
