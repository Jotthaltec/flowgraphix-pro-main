import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { ImportedVariant, ImportedVariantAxis } from "@/types/importedProduct";
import { attributeSignature, descriptorSegments, matchAxisOption, resolveVariantAttributes } from "@/services/variantAttributes";
import { normalizeScannedVariants } from "@/services/variantScan";
import { parseColorCode, normalizeKey } from "@/services/productNormalizer";
import { parseFuturaImProduct } from "@/services/futuraImParser";

const __dirname = dirname(fileURLToPath(import.meta.url));

const axis = (name: string, values: string[]): ImportedVariantAxis => ({
  name,
  normalized_name: normalizeKey(name),
  options: values.map((value) => ({ value, normalized_value: normalizeKey(value) })),
});

// Eixos REAIS do "Cartão de Visita em Couché Brilho" (FuturaIM, produto 104756).
const AXES = [
  axis("Material", ["Couché Brilho 250g", "Couché Brilho 300g", "Couché 300g"]),
  axis("Formato", ["88x48mm", "50x50mm"]),
  axis("Cor", ["4x0 - Colorido Frente", "4x4 - Colorido Frente e Verso", "4x1 - Colorido Frente e Preto e Branco Verso"]),
  axis("Enobrecimento", ["Sem Enobrecimento", "Verniz Total Brilho Frente", "Verniz Total Brilho Frente e Verso"]),
  axis("Acabamento", ["Refile", "Corte Redondo"]),
];

// As 15 combinações reais coletadas (que antes viravam todas "Cor: 8x4" ou "0x5").
const REAL: Array<[string, string]> = [
  ["81802", "500 Cartão de Visita Redondo - 50x50mm em Couché Brilho 300g - 4x0 - Verniz Total Brilho Frente - Corte Redondo"],
  ["81807", "500 Cartão de Visita Redondo - 50x50mm em Couché Brilho 300g - 4x1 - Verniz Total Brilho Frente - Corte Redondo"],
  ["81812", "500 Cartão de Visita Redondo - 50x50mm em Couché Brilho 300g - 4x4 - Verniz Total Brilho Frente - Corte Redondo"],
  ["104756", "50 Cartão de Visita - 88x48mm em Couché 300g - 4x0 - Sem Enobrecimento - Refile"],
  ["4571", "500 Cartão de Visita - 88x48mm em Couché 300g - 4x0 - Sem Enobrecimento - Refile"],
  ["4581", "500 Cartão de Visita - 88x48mm em Couché 300g - 4x4 - Sem Enobrecimento - Refile"],
  ["16972", "4000 Cartão de Visita - 88x48mm em Couché Brilho 250g - 4x1 - Verniz Total Brilho Frente - Refile"],
  ["4526", "500 Cartão de Visita - 88x48mm em Couché Brilho 250g - 4x0 - Verniz Total Brilho Frente - Refile"],
  ["4531", "500 Cartão de Visita - 88x48mm em Couché Brilho 250g - 4x1 - Verniz Total Brilho Frente - Refile"],
  ["4536", "500 Cartão de Visita - 88x48mm em Couché Brilho 250g - 4x4 - Verniz Total Brilho Frente - Refile"],
  ["4541", "500 Cartão de Visita - 88x48mm em Couché Brilho 250g - 4x0 - Verniz Total Brilho Frente e Verso - Refile"],
  ["4551", "500 Cartão de Visita - 88x48mm em Couché Brilho 250g - 4x4 - Verniz Total Brilho Frente e Verso - Refile"],
  ["4556", "500 Cartão de Visita - 88x48mm em Couché Brilho 300g - 4x0 - Verniz Total Brilho Frente - Refile"],
  ["4561", "500 Cartão de Visita - 88x48mm em Couché Brilho 300g - 4x1 - Verniz Total Brilho Frente - Refile"],
  ["4566", "500 Cartão de Visita - 88x48mm em Couché Brilho 300g - 4x4 - Verniz Total Brilho Frente - Refile"],
];

const variant = (external_id: string, title: string, tiers: Array<[number, number]>): ImportedVariant => ({
  external_id,
  sku: external_id,
  title,
  attributes: [],
  available: true,
  raw_attributes: { Cor: "8x4" }, // valor legado quebrado: tem que ser descartado
  price_tiers: tiers.map(([quantity, total_price]) => ({
    quantity,
    unit: "unidade",
    total_price,
    unit_price: total_price / quantity,
    currency: "BRL",
    available: true,
    collected_at: "2026-09-28T00:00:00Z",
  })),
});

describe("código de cor", () => {
  it("não lê cor dentro de medidas", () => {
    expect(parseColorCode("88x48mm").front_colors).toBeUndefined();
    expect(parseColorCode("50x50mm").front_colors).toBeUndefined();
    expect(parseColorCode("4x1 - Colorido Frente e Preto e Branco Verso").original_color_code).toBe("4x1");
    expect(parseColorCode("50 Cartão - 88x48mm em Couché 300g - 4x0 - Refile").original_color_code).toBe("4x0");
  });
});

describe("resolveVariantAttributes", () => {
  it("quebra o descritor em trechos úteis", () => {
    expect(descriptorSegments(REAL[4][1])).toEqual([
      "500 Cartão de Visita",
      "88x48mm em Couché 300g",
      "88x48mm",
      "Couché 300g",
      "4x0",
      "Sem Enobrecimento",
      "Refile",
    ]);
  });

  it("casa código de cor com o rótulo completo da opção", () => {
    expect(matchAxisOption(AXES[2], "4x1")).toEqual({
      value: "4x1 - Colorido Frente e Preto e Branco Verso",
      source: "code",
    });
    // "Couché 300g" não pode casar com "Couché Brilho 300g"
    expect(matchAxisOption(AXES[0], "Couché 300g")?.value).toBe("Couché 300g");
  });

  it("resolve TODOS os eixos das 15 combinações reais, sem ambiguidade", () => {
    for (const [id, title] of REAL) {
      const r = resolveVariantAttributes(title, AXES);
      expect(r.unresolved, id).toEqual([]);
      expect(Object.keys(r.attributes).sort(), id).toEqual(["Acabamento", "Cor", "Enobrecimento", "Formato", "Material"]);
    }
    expect(resolveVariantAttributes(REAL[10][1], AXES).attributes).toEqual({
      Material: "Couché Brilho 250g",
      Formato: "88x48mm",
      Cor: "4x0 - Colorido Frente",
      Enobrecimento: "Verniz Total Brilho Frente e Verso",
      Acabamento: "Refile",
    });
    expect(resolveVariantAttributes(REAL[0][1], AXES).attributes.Acabamento).toBe("Corte Redondo");
  });

  it("gera 13 combinações distintas (104756 e 16972 são SKUs de tiragem de 4571 e 4531)", () => {
    const signatures = new Set(REAL.map(([, t]) => attributeSignature(resolveVariantAttributes(t, AXES).attributes)));
    expect(signatures.size).toBe(13);
  });

  it("eixo ambíguo fica sem valor em vez de chutar", () => {
    const r = resolveVariantAttributes("Cartão - 88x48mm", AXES);
    expect(r.unresolved).toContain("Material");
    expect(r.attributes.Material).toBeUndefined();
  });
});

describe("normalizeScannedVariants", () => {
  it("descarta o valor legado, mescla tiragens e mantém o id de entrada", () => {
    const variants = REAL.map(([id, title]) =>
      variant(id, title, id === "104756" ? [[50, 50.98], [100, 58.48]] : id === "4571" ? [[100, 58.48], [500, 116.98]] : [[500, 100]]),
    );
    const { variants: out, warnings, aliases } = normalizeScannedVariants(variants, AXES, "104756");
    expect(out).toHaveLength(13);
    expect(warnings).toEqual([]);
    expect(aliases.get("4571")).toBe("104756");
    expect(aliases.get("16972") ?? aliases.get("4531")).toMatch(/^(4531|16972)$/);

    const entry = out.find((v) => v.external_id === "104756")!;
    expect(entry.price_tiers.map((t) => t.quantity)).toEqual([50, 100, 500]);
    expect(entry.raw_attributes.Cor).toBe("4x0 - Colorido Frente");
    expect(entry.color?.original_color_code).toBe("4x0");
    expect(entry.enoblement).toEqual(["Sem Enobrecimento"]);
    expect(entry.finishing).toEqual(["Refile"]);
    expect(out.every((v) => !Object.values(v.raw_attributes).includes("8x4"))).toBe(true);
  });

  it("sinaliza mesma combinação com preços diferentes (eixo oculto)", () => {
    const a = variant("1", REAL[4][1], [[500, 100]]);
    const b = variant("2", REAL[4][1], [[500, 130]]);
    const { variants: out, warnings } = normalizeScannedVariants([a, b], AXES);
    expect(out).toHaveLength(1);
    expect(warnings.join(" ")).toMatch(/preços diferentes/);
  });
});

describe("parser em página real", () => {
  it("cartão de visita: todos os eixos com o rótulo exato da opção, sem cor fantasma", () => {
    const html = readFileSync(join(__dirname, "fixtures", "futuraim-cartao-de-visita.html"), "utf8");
    const p = parseFuturaImProduct(html, "https://www.futuraim.com.br/produto/cartao?id=4627");
    const v = p.variants[0];
    const options = (name: string) => p.variant_axes.find((a) => a.normalized_name === name)?.options.map((o) => o.value) ?? [];
    for (const [k, value] of Object.entries(v.raw_attributes)) {
      const axisOptions = options(normalizeKey(k));
      if (axisOptions.length) expect(axisOptions, k).toContain(value);
    }
    expect(v.raw_attributes.Cor).toMatch(/^4x4/);
    expect(v.raw_attributes.Enobrecimento).toBeTruthy();
    expect(v.raw_attributes.Acabamento).toBe("Refile");
  });

  it("descrição não carrega o id do fornecedor nem o descritor de uma única combinação", () => {
    const cases: Array<[string, string, string, RegExp]> = [
      ["futuraim-cartao-de-visita.html", "4627", "https://www.futuraim.com.br/produto/cartao?id=4627", /sofistica/i],
      ["futuraim-rifa.html", "112791", "https://www.futuraim.com.br/produto/rifa-personalizada?id=112791", /pr[eê]mios/i],
    ];
    for (const [file, id, url, keeps] of cases) {
      const p = parseFuturaImProduct(readFileSync(join(__dirname, "fixtures", file), "utf8"), url);
      expect(p.description, file).toBeTruthy();
      expect(p.description, file).not.toContain(id);
      expect(p.description, file).toMatch(keeps); // o texto comercial continua
      expect(p.short_description ?? "", file).not.toContain(`${id} - `);
    }
  });
});
