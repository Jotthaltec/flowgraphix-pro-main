/**
 * Envio de e-mail transacional pelo Resend — SOMENTE no servidor.
 *
 * Sufixo `.server` pelo mesmo motivo de `integrations/supabase/client.server.ts`:
 * a `RESEND_API_KEY` dá poder de enviar e-mail em nome do domínio e nunca pode
 * ser inlineada no bundle do cliente. Nunca use prefixo `VITE_` nela.
 *
 * Falamos com a API REST via `fetch` em vez do SDK oficial: é uma única rota
 * (`POST /emails`), o `fetch` já existe no runtime nodejs22 da Vercel, e assim
 * o teste injeta um fetch falso sem precisar de chave nem de rede.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Para onde vai a resposta do cliente. Padrão: o próprio remetente. */
  replyTo?: string;
}

export interface SendEmailResult {
  id: string;
}

export interface EmailSenderConfig {
  apiKey: string;
  /** Remetente verificado no Resend, ex.: "Nexus Printi <orcamentos@nexusprinti.com.br>". */
  from: string;
  fetchImpl?: typeof fetch;
}

export function createEmailSender(config: EmailSenderConfig) {
  const doFetch = config.fetchImpl ?? fetch;

  return async function send(input: SendEmailInput): Promise<SendEmailResult> {
    const destinatarios = Array.isArray(input.to) ? input.to : [input.to];
    if (destinatarios.length === 0 || destinatarios.some((e) => !e?.includes("@"))) {
      throw new Error(`Destinatário de e-mail inválido: ${JSON.stringify(input.to)}`);
    }

    const response = await doFetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: destinatarios,
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      // O corpo de erro do Resend traz `message`; a chave nunca entra no log.
      const detalhe = await response.text().catch(() => "");
      throw new Error(
        `Resend recusou o envio (HTTP ${response.status}): ${detalhe || "sem detalhe"}`,
      );
    }

    const payload = (await response.json()) as { id?: string };
    if (!payload?.id) {
      throw new Error("Resend respondeu sem o id da mensagem.");
    }
    return { id: payload.id };
  };
}

/**
 * Envia usando as variáveis de ambiente do servidor. Mesma escolha de
 * `client.server.ts`: erro explícito nomeando o que falta, em vez de degradar
 * em silêncio e deixar o orçamento sumir sem ninguém perceber.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    const faltando = [...(!apiKey ? ["RESEND_API_KEY"] : []), ...(!from ? ["RESEND_FROM"] : [])];
    throw new Error(
      `Faltam variáveis de ambiente para enviar e-mail: ${faltando.join(", ")}. Ver deploy/resend/README.md.`,
    );
  }

  return createEmailSender({ apiKey, from })(input);
}
