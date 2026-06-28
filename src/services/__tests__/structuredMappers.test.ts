import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseFuturaImProduct } from "@/services/futuraImParser";
import {
  buildVariantRow,
  buildPriceTierRows,
  buildAttributeRows,
  buildImageRows,
  buildExtraRows,
} from "@/services/structuredMappers";
import type { ImportedProduct } from "@/types/importedProduct";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (n: string) => readFileSync(join(__dirname, "fixtures", n), "utf8");
const URL = "https://www.futuraim.com.br/produto/cartao-de-visita-em-couche-fosco-com-laminacao-fosca-e-verniz-localizado?id=4627";

describe("structuredMappers (a partir do produto real parseado)", () => {
  let product: ImportedProduct;
  beforeAll(() => {
    product = parseFuturaImProduct(fixture("futuraim-cartao-de-visita.html"), URL);
  });

  it("variantRow separa material/formato/cor em campos próprios (não no nome)", () => {
    const v = buildVariantRow(product.variants[0]);
    expect(v.external_id).toBe("4627");
    expect(v.format_original).toBeTruthy();
    expect(v.width_mm).toBeGreaterThan(0); // 88x48mm -> 88
    expect(v.print_color).toMatch(/\dx\d/); // 4x4
    expect(typeof v.raw_attributes).toBe("object");
  });

  it("priceTierRows preserva tiragens reais com id externo por faixa", () => {
    const rows = buildPriceTierRows(product.variants[0]);
    expect(rows.length).toBeGreaterThanOrEqual(5);
    const t100 = rows.find((r) => r.quantity === 100);
    expect(t100?.total_price).toBe(88.99);
    expect(rows.some((r) => r.external_id)).toBe(true);
  });

  it("attributeRows funde specs + eixos sem duplicar atributo", () => {
    const attrs = buildAttributeRows(product);
    const names = attrs.map((a) => a.normalized_name);
    // sem duplicatas
    expect(new Set(names).size).toBe(names.length);
    // formato deve ter várias opções (eixo) + valores deduplicados
    const formato = attrs.find((a) => a.normalized_name === "formato");
    expect(formato && formato.values.length).toBeGreaterThan(1);
    expect(formato!.values.every((v) => v.value)).toBe(true);
  });

  it("imageRows marca exatamente uma principal", () => {
    const imgs = buildImageRows(product);
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs.filter((i) => i.is_main).length).toBe(1);
  });

  it("extraRows traz serviços reais (Criação de Arte etc.)", () => {
    const extras = buildExtraRows(product);
    expect(extras.some((e) => /cria[cç][aã]o de arte/i.test(e.name))).toBe(true);
    expect(extras.every((e) => e.price >= 0)).toBe(true);
  });
});
