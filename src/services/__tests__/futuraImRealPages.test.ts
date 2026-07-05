import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseFuturaImProduct } from "@/services/futuraImParser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");

/**
 * Cobertura sobre múltiplos produtos REAIS da FuturaIM (seções 32–34).
 * Valida que cada tipo cai na categoria/subcategoria correta, que técnica e
 * categoria não se confundem (DTF UV ≠ DTF Têxtil) e que tamanho de vestuário
 * não vira dimensão gráfica.
 */
const CASES: Array<{
  file: string;
  url: string;
  category: string;
  subcategory: string;
  sector?: string;
}> = [
  {
    file: "futuraim-dtf-uv.html",
    url: "https://www.futuraim.com.br/produto/dtf-uv?id=87625",
    category: "Adesivos e Rótulos",
    subcategory: "DTF UV",
    sector: "DTF UV",
  },
  {
    file: "futuraim-camiseta.html",
    url: "https://www.futuraim.com.br/produto/camiseta-dry-fit-masculina?id=103154",
    category: "Vestuário e Têxtil",
    subcategory: "Camiseta",
  },
  {
    file: "futuraim-adesivo-vinil.html",
    url: "https://www.futuraim.com.br/produto/adesivo-em-vinil?id=11867",
    category: "Adesivos e Rótulos",
    subcategory: "Adesivo em Vinil",
  },
  {
    file: "futuraim-caneca.html",
    url: "https://www.futuraim.com.br/produto/canecas-personalizadas-porcelana?id=16448",
    category: "Brindes e Personalizados",
    subcategory: "Caneca",
  },
];

describe("FuturaIM — páginas reais (classificação)", () => {
  for (const c of CASES) {
    it(`${c.subcategory}: ${c.file}`, () => {
      const p = parseFuturaImProduct(fixture(c.file), c.url);
      expect(p.external_id).toBe(c.url.match(/id=(\d+)/)![1]);
      expect(p.original_name.length).toBeGreaterThan(0);
      expect(p.classification.category).toBe(c.category);
      expect(p.classification.subcategory).toBe(c.subcategory);
      if (c.sector) expect(p.classification.production_sector).toBe(c.sector);
      // sempre estruturado: pelo menos uma imagem real e supplier correto
      expect(p.supplier).toBe("FuturaIM");
      expect(p.images.length).toBeGreaterThan(0);
    });
  }

  it("Rifa Personalizada extrai TODOS os eixos (Material, Formato, Cor, Enobrecimento, Acabamento)", () => {
    const p = parseFuturaImProduct(fixture("futuraim-rifa.html"), "https://www.futuraim.com.br/produto/rifa-personalizada?id=112791");
    const axes = p.variant_axes.map((a) => a.normalized_name);
    expect(axes).toContain("material");
    expect(axes).toContain("formato");
    expect(axes).toContain("cor");
    expect(axes).toContain("enobrecimento");
    expect(axes).toContain("acabamento");
    // cada eixo tem ao menos 1 valor não vazio
    for (const a of p.variant_axes) {
      expect(a.options.length).toBeGreaterThan(0);
      expect(a.options.every((o) => o.value.trim().length > 0)).toBe(true);
    }
    // specs derivadas refletem os eixos selecionados
    const specNames = p.specifications.map((s) => s.normalized_name);
    expect(specNames).toContain("material");
    expect(specNames).toContain("cor");
  });

  it("extrai prazo de produção do fornecedor (dias úteis + frete)", () => {
    const rifa = parseFuturaImProduct(fixture("futuraim-rifa.html"), "https://www.futuraim.com.br/produto/rifa-personalizada?id=112791");
    expect(rifa.production_time?.production_days).toBe(3);
    expect(rifa.production_time?.production_day_type).toBe("business_days");
    expect(rifa.production_time?.freight_not_included).toBe(true);

    const cartao = parseFuturaImProduct(
      fixture("futuraim-cartao-de-visita.html"),
      "https://www.futuraim.com.br/produto/cartao?id=4627",
    );
    expect(cartao.production_time?.production_days).toBe(2);
  });

  it("a MAIOR tiragem tem preço real (não vaza para frete/extra após a tabela)", () => {
    // Regressão: o HTML da FuturaIM não fecha <tr>/<td>; sem limitar a linha ao
    // </table>, a última tiragem capturava o último R$ da página (frete R$ 9,99)
    // em vez do total real. Aqui garantimos que a maior quantidade é a mais cara.
    const cases: Array<[string, number, number]> = [
      // arquivo, maior quantidade esperada, preço total mínimo aceitável
      ["futuraim-banner.html", 50, 700],
      ["futuraim-camiseta.html", 100, 3000],
      ["futuraim-cartao-de-visita.html", 20000, 1500],
    ];
    for (const [file, maxQty, minPrice] of cases) {
      const p = parseFuturaImProduct(fixture(file), "https://www.futuraim.com.br/produto/x?id=1");
      const tiers = p.variants[0]?.price_tiers || [];
      const top = tiers[tiers.length - 1];
      expect(top.quantity).toBe(maxQty);
      expect(top.total_price).toBeGreaterThan(minPrice);
      // a maior tiragem é a de maior preço total (monotônico no topo)
      const maxPrice = Math.max(...tiers.map((t) => t.total_price));
      expect(top.total_price).toBe(maxPrice);
    }
  });

  it("DTF UV não é classificado como DTF Têxtil (seção 32)", () => {
    const p = parseFuturaImProduct(fixture("futuraim-dtf-uv.html"), "https://www.futuraim.com.br/produto/dtf-uv?id=87625");
    expect(p.classification.subcategory).not.toBe("DTF Têxtil");
    expect(p.classification.category).not.toBe("Vestuário e Têxtil");
  });
});
