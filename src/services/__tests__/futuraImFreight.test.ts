/**
 * Testes do frete real da FuturaIM (seção 11).
 *
 * O fragmento abaixo é a resposta REAL de
 *   POST /produtos/frete-sku/?cep=01001000&produtoId=4627&quantidade=1000
 * (capturada com cookie antiforgery + header RequestVerificationToken).
 */

import { describe, it, expect } from "vitest";
import {
  buildFreightPath,
  extractAntiForgeryToken,
  isValidCep,
  parseFuturaImFreight,
} from "../futuraImFreight";

const REAL_FRAGMENT = `
            <div class="row mb-1">
                <div class="col-5">
                JAD - Delivery
                </div>
                <div class="col-4">
                    2  dias &#xFA;teis
                </div>
                <div class="col-3">

                        Gr&#xE1;tis


                </div>
            </div>
`;

const TWO_OPTIONS = `
  <div class="row mb-1">
    <div class="col-5">JAD - Delivery</div>
    <div class="col-4">2  dias úteis</div>
    <div class="col-3">Grátis</div>
  </div>
  <div class="row mb-1">
    <div class="col-5">Correios - PAC</div>
    <div class="col-4">7 dias úteis</div>
    <div class="col-3">R$ 32,90</div>
  </div>
`;

describe("parseFuturaImFreight", () => {
  it("lê o fragmento REAL do fornecedor (transportadora, prazo, grátis)", () => {
    const opts = parseFuturaImFreight(REAL_FRAGMENT);
    expect(opts).toHaveLength(1);
    expect(opts[0].carrier).toBe("JAD - Delivery");
    expect(opts[0].days).toBe(2);
    expect(opts[0].free).toBe(true);
    expect(opts[0].cost).toBe(0);
  });

  it("lê múltiplas opções e converte o preço BR", () => {
    const opts = parseFuturaImFreight(TWO_OPTIONS);
    expect(opts).toHaveLength(2);
    expect(opts[1].carrier).toBe("Correios - PAC");
    expect(opts[1].days).toBe(7);
    expect(opts[1].free).toBe(false);
    expect(opts[1].cost).toBeCloseTo(32.9);
  });

  it("não inventa cotação: fragmento vazio ou sem preço → lista vazia", () => {
    expect(parseFuturaImFreight("")).toEqual([]);
    const semPreco = `<div class="row"><div class="col-5">X</div><div class="col-4">2 dias</div><div class="col-3">--</div></div>`;
    expect(parseFuturaImFreight(semPreco)).toEqual([]);
  });
});

describe("extractAntiForgeryToken", () => {
  it("extrai token com value SEM aspas (HTML minificado da FuturaIM)", () => {
    const html = `<input name=__RequestVerificationToken type=hidden value=CfDJ8ABC-123_xyz>`;
    expect(extractAntiForgeryToken(html)).toBe("CfDJ8ABC-123_xyz");
  });

  it("extrai token com value entre aspas", () => {
    const html = `<input name="__RequestVerificationToken" type="hidden" value="tok-42" />`;
    expect(extractAntiForgeryToken(html)).toBe("tok-42");
  });

  it("retorna null quando não há token", () => {
    expect(extractAntiForgeryToken("<html></html>")).toBeNull();
  });
});

describe("buildFreightPath / isValidCep", () => {
  it("limpa o CEP e a quantidade", () => {
    expect(buildFreightPath("01001-000", "4627", 1000)).toBe(
      "/produtos/frete-sku/?cep=01001000&produtoId=4627&quantidade=1000",
    );
  });

  it("quantidade inválida vira 1", () => {
    expect(buildFreightPath("01001000", "4627", 0)).toContain("quantidade=1");
    expect(buildFreightPath("01001000", "4627", NaN)).toContain("quantidade=1");
  });

  it("valida CEP de 8 dígitos", () => {
    expect(isValidCep("01001-000")).toBe(true);
    expect(isValidCep("0100100")).toBe(false);
    expect(isValidCep("")).toBe(false);
  });
});
