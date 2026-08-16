import { describe, it, expect, vi, afterEach } from "vitest";
import { createEmailSender, sendEmail } from "@/services/email/resend.server";

/** Resposta mínima que o `createEmailSender` sabe interpretar. */
const respostaOk = (body: unknown = { id: "msg_123" }) =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

const respostaErro = (status: number, body: string) =>
  ({
    ok: false,
    status,
    json: async () => JSON.parse(body),
    text: async () => body,
  }) as unknown as Response;

const enviarCom = (fetchImpl: typeof fetch) =>
  createEmailSender({
    apiKey: "re_chave_de_teste",
    from: "Nexus Printi <orcamentos@nexusprinti.com.br>",
    fetchImpl,
  });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createEmailSender", () => {
  it("chama a API do Resend com Bearer e o corpo esperado", async () => {
    const fake = vi.fn(async () => respostaOk());
    const send = enviarCom(fake as unknown as typeof fetch);

    const result = await send({
      to: "cliente@exemplo.com",
      subject: "Orçamento ORC-1",
      html: "<p>oi</p>",
      text: "oi",
    });

    expect(result).toEqual({ id: "msg_123" });
    expect(fake).toHaveBeenCalledTimes(1);

    const [url, init] = fake.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_chave_de_teste");

    const body = JSON.parse(init.body as string);
    expect(body.from).toBe("Nexus Printi <orcamentos@nexusprinti.com.br>");
    expect(body.to).toEqual(["cliente@exemplo.com"]);
    expect(body.subject).toBe("Orçamento ORC-1");
  });

  it("aceita vários destinatários", async () => {
    const fake = vi.fn(async () => respostaOk());
    await enviarCom(fake as unknown as typeof fetch)({
      to: ["a@x.com", "b@x.com"],
      subject: "s",
      html: "h",
    });
    const body = JSON.parse(
      (fake.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.to).toEqual(["a@x.com", "b@x.com"]);
  });

  it("só manda reply_to quando ele foi informado", async () => {
    const fake = vi.fn(async () => respostaOk());
    await enviarCom(fake as unknown as typeof fetch)({ to: "a@x.com", subject: "s", html: "h" });
    const body = JSON.parse(
      (fake.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body).not.toHaveProperty("reply_to");
  });

  it("recusa destinatário sem @ antes de gastar uma chamada de rede", async () => {
    const fake = vi.fn(async () => respostaOk());
    await expect(
      enviarCom(fake as unknown as typeof fetch)({ to: "nao-e-email", subject: "s", html: "h" }),
    ).rejects.toThrow(/inválido/i);
    expect(fake).not.toHaveBeenCalled();
  });

  it("propaga o erro do Resend com status e detalhe", async () => {
    const fake = vi.fn(async () => respostaErro(422, '{"message":"domain not verified"}'));
    await expect(
      enviarCom(fake as unknown as typeof fetch)({ to: "a@x.com", subject: "s", html: "h" }),
    ).rejects.toThrow(/422.*domain not verified/s);
  });

  it("falha quando a resposta vem sem id", async () => {
    const fake = vi.fn(async () => respostaOk({}));
    await expect(
      enviarCom(fake as unknown as typeof fetch)({ to: "a@x.com", subject: "s", html: "h" }),
    ).rejects.toThrow(/sem o id/i);
  });
});

describe("sendEmail", () => {
  it("nomeia as duas variáveis quando nenhuma está configurada", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_FROM", "");
    await expect(sendEmail({ to: "a@x.com", subject: "s", html: "h" })).rejects.toThrow(
      /RESEND_API_KEY, RESEND_FROM/,
    );
  });

  it("nomeia só a que falta", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_x");
    vi.stubEnv("RESEND_FROM", "");
    await expect(sendEmail({ to: "a@x.com", subject: "s", html: "h" })).rejects.toThrow(
      /Faltam.*RESEND_FROM/s,
    );
  });
});
