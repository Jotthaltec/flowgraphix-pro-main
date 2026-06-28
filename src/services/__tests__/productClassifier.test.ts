import { describe, it, expect } from "vitest";
import { classifyProduct } from "@/services/productClassifier";

describe("productClassifier", () => {
  it("Cartão de Visita -> Impressos Promocionais / Cartão de Visita", () => {
    const c = classifyProduct({ name: "Cartão de Visita em Couché Fosco", breadcrumb: ["Cartão de Visita"] });
    expect(c.category).toBe("Impressos Promocionais");
    expect(c.subcategory).toBe("Cartão de Visita");
    expect(c.confidence).toBeGreaterThanOrEqual(80);
    expect(c.review_required).toBe(false);
  });

  it("DTF UV cai em Adesivos e Rótulos / DTF UV e técnica DTF UV (não têxtil)", () => {
    const c = classifyProduct({ name: "DTF UV em Folha A3" });
    expect(c.category).toBe("Adesivos e Rótulos");
    expect(c.subcategory).toBe("DTF UV");
    expect(c.production_sector).toBe("DTF UV");
  });

  it("DTF Têxtil é distinto de DTF UV (Vestuário)", () => {
    const c = classifyProduct({ name: "DTF Têxtil para Camiseta" });
    expect(c.category).toBe("Vestuário e Têxtil");
    expect(c.production_sector).toBe("DTF Têxtil");
  });

  it("Camiseta Dry Fit -> Vestuário / Camiseta", () => {
    const c = classifyProduct({ name: "Camiseta Dry Fit Masculina" });
    expect(c.category).toBe("Vestuário e Têxtil");
    expect(c.subcategory).toBe("Camiseta");
  });

  it("Wind Banner ganha precedência sobre Banner", () => {
    const c = classifyProduct({ name: "Wind Banner Kit Completo" });
    expect(c.subcategory).toBe("Wind Banner");
    expect(c.category).toBe("Comunicação Visual");
  });

  it("segmento NÃO vira categoria (seção 22): Cardápio para Pizzaria", () => {
    const c = classifyProduct({ name: "Cardápio em Plástico", description: "Ideal para pizzaria e restaurante" });
    expect(c.subcategory).toBe("Cardápio");
    expect(c.category).toBe("Impressos Promocionais");
    expect(c.segments).toContain("Restaurante/Pizzaria");
    expect(c.category).not.toContain("Pizzaria");
  });

  it("produto desconhecido marca revisão necessária", () => {
    const c = classifyProduct({ name: "Engenhoca Misteriosa XYZ" });
    expect(c.category).toBe("Não classificado");
    expect(c.review_required).toBe(true);
    expect(c.confidence).toBe(0);
  });

  it("Sacola Plástica e Sacola de Papel são subcategorias distintas", () => {
    expect(classifyProduct({ name: "Sacola Plástica Personalizada" }).subcategory).toBe("Sacola Plástica");
    expect(classifyProduct({ name: "Sacola de Papel Kraft" }).subcategory).toBe("Sacola de Papel");
  });
});
