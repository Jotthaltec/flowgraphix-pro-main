import { describe, it, expect } from "vitest";
import { escapeHtml, renderContractEmail, renderQuoteEmail } from "@/services/email/templates";

/**
 * O Intl separa "R$" do número com espaço não separável (U+00A0). Sem normalizar,
 * a comparação com um espaço comum falha por um caractere invisível.
 */
const norm = (s: string) => s.replace(/\u00A0/g, " ");

const orcamentoBase = {
  quoteNumber: "ORC-2026-014",
  clientName: "Padaria do Zé",
  serviceDesc: "Cartão de visita couché 300g",
  quantity: 1000,
  finalValue: 289.9,
};

describe("renderQuoteEmail", () => {
  it("põe número do orçamento e empresa no assunto", () => {
    const { subject } = renderQuoteEmail({ ...orcamentoBase, companyName: "Gráfica X" });
    expect(subject).toBe("Orçamento ORC-2026-014 — Gráfica X");
  });

  it("usa Nexus Printi quando a empresa não vem", () => {
    expect(renderQuoteEmail(orcamentoBase).subject).toContain("Nexus Printi");
  });

  it("formata o valor em real", () => {
    expect(norm(renderQuoteEmail(orcamentoBase).text)).toContain("R$ 289,90");
  });

  it("omite linhas sem valor em vez de mostrar campo vazio", () => {
    const { text } = renderQuoteEmail(orcamentoBase);
    expect(text).not.toContain("Válido até");
    expect(text).not.toContain("Observações");
    expect(text).not.toContain("Prazo de entrega");
  });

  it("mostra prazo e validade quando vêm preenchidos", () => {
    const { text } = renderQuoteEmail({
      ...orcamentoBase,
      deliveryDays: 5,
      validUntil: "2026-08-20",
    });
    expect(text).toContain("Prazo de entrega: 5 dia(s) úteis");
    expect(text).toContain("Válido até: 20/08/2026");
  });

  it("não devolve a data um dia para trás em fuso negativo", () => {
    const { text } = renderQuoteEmail({ ...orcamentoBase, validUntil: "2026-01-01" });
    expect(text).toContain("01/01/2026");
  });

  it("escapa marcação vinda do nome do cliente", () => {
    const { html } = renderQuoteEmail({
      ...orcamentoBase,
      clientName: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderContractEmail", () => {
  const contratoBase = {
    contractNumber: "CT-2026-003",
    clientName: "Padaria do Zé",
    totalValue: 1500,
  };

  it("monta o assunto com o número do contrato", () => {
    expect(renderContractEmail(contratoBase).subject).toBe("Contrato CT-2026-003 — Nexus Printi");
  });

  it("inclui entrada e forma de pagamento quando existem", () => {
    const { text } = renderContractEmail({
      ...contratoBase,
      downPayment: 500,
      paymentMethod: "Pix em 2x",
    });
    expect(norm(text)).toContain("Entrada: R$ 500,00");
    expect(norm(text)).toContain("Forma de pagamento: Pix em 2x");
  });

  it("omite a entrada quando ela é zero", () => {
    const { text } = renderContractEmail({ ...contratoBase, downPayment: 0 });
    expect(text).not.toContain("Entrada");
  });
});

describe("escapeHtml", () => {
  it("escapa os cinco caracteres perigosos", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
});
