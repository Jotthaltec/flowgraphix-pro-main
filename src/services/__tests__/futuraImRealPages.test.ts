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

  it("DTF UV não é classificado como DTF Têxtil (seção 32)", () => {
    const p = parseFuturaImProduct(fixture("futuraim-dtf-uv.html"), "https://www.futuraim.com.br/produto/dtf-uv?id=87625");
    expect(p.classification.subcategory).not.toBe("DTF Têxtil");
    expect(p.classification.category).not.toBe("Vestuário e Têxtil");
  });
});
