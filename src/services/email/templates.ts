/**
 * Templates dos e-mails que o CRM envia ao cliente final.
 *
 * São funções puras: recebem os dados já lidos do banco e devolvem assunto,
 * HTML e texto. Nada de rede aqui — quem envia é `resend.server.ts`. Isso
 * mantém os templates testáveis sem chave de API e sem tocar no Resend.
 *
 * Todo valor vindo do banco passa por `escapeHtml`: nome de cliente e
 * observações são texto livre digitado no CRM e não podem virar marcação.
 */

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

/**
 * Datas do Postgres chegam como `2026-08-20` ou ISO completo. O fuso fixo em
 * UTC evita que uma data pura volte um dia para quem está em UTC-3.
 */
const dataBR = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", dateStyle: "short" }).format(d);
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Uma linha "rótulo: valor" do resumo. Valor nulo some do e-mail. */
type Linha = [rotulo: string, valor: string | null | undefined];

const linhasVisiveis = (linhas: Linha[]) =>
  linhas.filter((l): l is [string, string] => Boolean(l[1]));

function montar(
  titulo: string,
  saudacao: string,
  linhas: Linha[],
  rodape: string,
): {
  html: string;
  text: string;
} {
  const visiveis = linhasVisiveis(linhas);

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
    <h1 style="margin:0 0 24px;font-size:20px;">${escapeHtml(titulo)}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.5;">${escapeHtml(saudacao)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:15px;">
${visiveis
  .map(
    ([rotulo, valor]) =>
      `      <tr><td style="padding:8px 0;color:#666;">${escapeHtml(rotulo)}</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${escapeHtml(valor)}</td></tr>`,
  )
  .join("\n")}
    </table>
    <p style="margin:24px 0 0;font-size:13px;color:#666;line-height:1.5;">${escapeHtml(rodape)}</p>
  </div>
</body>
</html>`;

  const text = [
    titulo,
    "",
    saudacao,
    "",
    ...visiveis.map(([rotulo, valor]) => `${rotulo}: ${valor}`),
    "",
    rodape,
  ].join("\n");

  return { html, text };
}

export interface QuoteEmailInput {
  quoteNumber: string;
  clientName: string;
  serviceDesc: string;
  quantity: number;
  finalValue: number;
  validUntil?: string | null;
  deliveryDays?: number | null;
  notes?: string | null;
  companyName?: string | null;
}

export function renderQuoteEmail(input: QuoteEmailInput): RenderedEmail {
  const empresa = input.companyName?.trim() || "Nexus Printi";

  const { html, text } = montar(
    `Orçamento ${input.quoteNumber}`,
    `Olá, ${input.clientName}. Segue o orçamento solicitado.`,
    [
      ["Serviço", input.serviceDesc],
      ["Quantidade", String(input.quantity)],
      ["Valor total", brl(input.finalValue)],
      ["Prazo de entrega", input.deliveryDays ? `${input.deliveryDays} dia(s) úteis` : null],
      ["Válido até", dataBR(input.validUntil)],
      ["Observações", input.notes?.trim() || null],
    ],
    `Orçamento emitido por ${empresa}. Em caso de dúvida, basta responder a este e-mail.`,
  );

  return { subject: `Orçamento ${input.quoteNumber} — ${empresa}`, html, text };
}

export interface ContractEmailInput {
  contractNumber: string;
  clientName: string;
  totalValue: number;
  downPayment?: number | null;
  paymentMethod?: string | null;
  deliveryDate?: string | null;
  productionDeadline?: string | null;
  notes?: string | null;
  companyName?: string | null;
}

export function renderContractEmail(input: ContractEmailInput): RenderedEmail {
  const empresa = input.companyName?.trim() || "Nexus Printi";

  const { html, text } = montar(
    `Contrato ${input.contractNumber}`,
    `Olá, ${input.clientName}. Segue a sua via do contrato.`,
    [
      ["Valor total", brl(input.totalValue)],
      ["Entrada", input.downPayment ? brl(input.downPayment) : null],
      ["Forma de pagamento", input.paymentMethod?.trim() || null],
      ["Prazo de produção", dataBR(input.productionDeadline)],
      ["Data de entrega", dataBR(input.deliveryDate)],
      ["Observações", input.notes?.trim() || null],
    ],
    `Contrato emitido por ${empresa}. Guarde este e-mail como comprovante.`,
  );

  return { subject: `Contrato ${input.contractNumber} — ${empresa}`, html, text };
}
