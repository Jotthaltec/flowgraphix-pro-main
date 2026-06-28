import { describe, it, expect } from "vitest";
import {
  deburr,
  normalizeKey,
  slugify,
  parsePriceBR,
  parseDimensions,
  parseColorCode,
  parseMaterial,
  parseProductionTime,
  parseQuantity,
} from "@/services/productNormalizer";

describe("productNormalizer", () => {
  it("deburr/normalizeKey/slugify", () => {
    expect(deburr("Couché Brilho")).toBe("Couche Brilho");
    expect(normalizeKey("Couché Brilho 300g")).toBe("couche_brilho_300g");
    expect(slugify("Cartão de Visita")).toBe("cartao-de-visita");
  });

  it("parsePriceBR cobre BR e internacional", () => {
    expect(parsePriceBR("R$ 1.301,99")).toBe(1301.99);
    expect(parsePriceBR("97,99")).toBe(97.99);
    expect(parsePriceBR("110.99")).toBe(110.99);
    expect(parsePriceBR("1,299.99")).toBe(1299.99);
    expect(parsePriceBR("R$ 88,99")).toBe(88.99);
    expect(parsePriceBR(110.99)).toBe(110.99);
    expect(parsePriceBR("")).toBe(0);
  });

  it("parseDimensions converte para mm e preserva original", () => {
    expect(parseDimensions("88x48mm")).toMatchObject({ width_mm: 88, height_mm: 48, unit: "mm" });
    expect(parseDimensions("21x29,7cm")).toMatchObject({ width_mm: 210, height_mm: 297, unit: "cm" });
    expect(parseDimensions("1x2m")).toMatchObject({ width_mm: 1000, height_mm: 2000, unit: "m" });
  });

  it("não transforma tamanho de vestuário em dimensão (seção 12)", () => {
    const g = parseDimensions("G");
    expect(g.unit).toBe("size_label");
    expect(g.width_mm).toBeUndefined();
  });

  it("parseColorCode interpreta 4x4 e 5x0 (branco)", () => {
    const c44 = parseColorCode("4x4");
    expect(c44).toMatchObject({ front_colors: 4, back_colors: 4, front_printed: true, back_printed: true });
    const c50 = parseColorCode("5x0 - Colorido com branco");
    expect(c50.has_white_ink).toBe(true);
    expect(c50.back_printed).toBe(false);
  });

  it("parseMaterial separa família, superfície e gramatura sem perder o original", () => {
    const m = parseMaterial("Couché Brilho 300g");
    expect(m).toMatchObject({ material_family: "Couché", surface: "Brilho", grammage_gsm: 300 });
    expect(m.original_material).toBe("Couché Brilho 300g");
    const p = parseMaterial("Polionda Branca 4mm 750g");
    expect(p).toMatchObject({ grammage_gsm: 750, thickness_mm: 4, color: "branca" });
  });

  it("parseProductionTime decompõe '2 dias úteis + frete'", () => {
    const t = parseProductionTime("2 dias úteis + frete");
    expect(t).toMatchObject({ production_days: 2, production_day_type: "business_days", freight_not_included: true });
  });

  it("parseQuantity lê milhares com ponto", () => {
    expect(parseQuantity("5.000 unidades")).toBe(5000);
    expect(parseQuantity("100")).toBe(100);
  });
});
