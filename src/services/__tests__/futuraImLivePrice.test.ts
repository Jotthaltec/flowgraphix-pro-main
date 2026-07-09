/**
 * Testes do LIVE_RESOLVER de tamanho personalizado (§8).
 *
 * Os fragmentos abaixo são respostas REAIS de
 *   POST /produto/adesivo-em-vinil?id=71910   (com token + cookie antiforgery)
 */

import { describe, it, expect } from "vitest";
import {
  extractProductFormFields,
  parseLivePriceFragment,
  supportsCustomSize,
} from "../futuraImLivePrice";

/** Resposta real para Largura=500, Altura=500, Quantidade=4 → Total R$ 260,00. */
const REAL_FRAGMENT = `
<div id="precoFooter"> <div class="container"> <div class="row align-items-center no-gutters produtoGeral-footer-row">
  <div class="col-12 col-md-4">
    <div class="descricao-produto">
      <span>1 Adesivo cm&#xB2; em Vinil Adesivo Branco Brilho 120g - 4x0 - Verniz Localizado Frente - Rolo Meio-Corte Personalizado</span> (71910)
    </div>
  </div>
  <div class="col-12 col-md-8 d-flex flex-wrap align-items-center produtoGeral-footer-right">
    <div class="footer-preco-info">
      <div class="justify-end">
        <span class="footer-preco-label">Total</span>
        <span class="txt-valor"> R$ 260,00 </span>
      </div>
      <div class="justify-end"> até 3x de R$ 86,67 sem juros </div>
    </div>
  </div>
</div> </div> </div>
`;

/** Resposta real para dimensão fora dos limites (ex.: 10x10 ou 1000x1000). */
const OUT_OF_RANGE_FRAGMENT = REAL_FRAGMENT.replace("R$ 260,00", "R$ 0,00");

describe("parseLivePriceFragment", () => {
  it("lê o Total oficial do fragmento REAL", () => {
    const r = parseLivePriceFragment(REAL_FRAGMENT)!;
    expect(r.total_price).toBeCloseTo(260);
    expect(r.has_price).toBe(true);
  });

  it("NÃO confunde o parcelamento ('até 3x de R$ 86,67') com o total", () => {
    const r = parseLivePriceFragment(REAL_FRAGMENT)!;
    expect(r.total_price).not.toBeCloseTo(86.67);
  });

  it("confirma o ProdutoId e o descritor devolvidos pelo fornecedor", () => {
    const r = parseLivePriceFragment(REAL_FRAGMENT)!;
    expect(r.external_product_id).toBe("71910");
    expect(r.descriptor).toContain("Adesivo cm²");
    expect(r.descriptor).toContain("Vinil Adesivo Branco Brilho 120g");
  });

  it("Total 0,00 = dimensão fora dos limites, nunca 'grátis'", () => {
    const r = parseLivePriceFragment(OUT_OF_RANGE_FRAGMENT)!;
    expect(r.total_price).toBe(0);
    expect(r.has_price).toBe(false);
  });

  it("fragmento sem rodapé de preço → null (não consultou, não é preço zero)", () => {
    expect(parseLivePriceFragment("<div>nada</div>")).toBeNull();
    expect(parseLivePriceFragment("")).toBeNull();
  });
});

describe("supportsCustomSize", () => {
  it("detecta o marcador FlagDimensaoManual (HTML minificado, sem aspas)", () => {
    expect(supportsCustomSize("<input type=hidden id=FlagDimensaoManual value=value>")).toBe(true);
    expect(supportsCustomSize('<input type="hidden" id="FlagDimensaoManual" />')).toBe(true);
  });

  it("produto de formato fixo não oferece medida manual", () => {
    expect(supportsCustomSize("<input type=hidden id=ProdutoId value=22502>")).toBe(false);
  });
});

describe("extractProductFormFields", () => {
  it("lê os campos do #formProduto mesmo com atributos sem aspas", () => {
    const html = `
      <input type=hidden name=ProdutoId id=ProdutoId value=71910>
      <input type=hidden name=Quantidade value=1>
      <input type=hidden name=Largura value=0>
      <input type="hidden" name="GrupoSku" value="Adesivo em Vinil" />
    `;
    const f = extractProductFormFields(html);
    expect(f.ProdutoId).toBe("71910");
    expect(f.Quantidade).toBe("1");
    expect(f.Largura).toBe("0");
    expect(f.GrupoSku).toBe("Adesivo em Vinil");
  });

  it("o primeiro valor vence (form do produto vem antes do rodapé)", () => {
    const html = `<input name=ProdutoId value=71910><input name=ProdutoId value=999>`;
    expect(extractProductFormFields(html).ProdutoId).toBe("71910");
  });
});
