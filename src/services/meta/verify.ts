import { z } from "zod";

/**
 * Verificação da conexão com a Meta para o painel: o Pixel configurado existe
 * e é acessível pelo token? O token é de usuário do sistema ou pessoal, e
 * quando vence? Nunca devolve o token; respostas da Meta tratadas como não
 * confiáveis.
 */

export type MetaCheck = {
  pixel: { ok: boolean; name: string | null; business: string | null; message: string };
  token: {
    ok: boolean;
    type: string | null;
    expiresAt: string | null;
    daysLeft: number | null;
    message: string;
  };
};

const pixelSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  owner_business: z.object({ id: z.string(), name: z.string().optional() }).optional(),
});
const errorSchema = z.object({
  error: z.object({ message: z.string().optional(), code: z.number().optional() }),
});
const debugSchema = z.object({
  data: z.object({
    type: z.string().optional(),
    app_id: z.string().optional(),
    is_valid: z.boolean().optional(),
    expires_at: z.number().optional(),
  }),
});

/** Dias inteiros até a data (negativo = vencido); null quando não expira. */
export function daysUntil(expiresAt: number | undefined, now: Date): number | null {
  if (!expiresAt) return null;
  return Math.floor((expiresAt * 1000 - now.getTime()) / 86_400_000);
}

export function interpretToken(
  raw: unknown,
  now: Date,
): MetaCheck["token"] & { appId: string | null } {
  const parsed = debugSchema.safeParse(raw);
  if (!parsed.success || parsed.data.data.is_valid === false) {
    return {
      ok: false,
      type: null,
      expiresAt: null,
      daysLeft: null,
      appId: null,
      message: "Token inválido ou revogado: gere outro e substitua no Vault.",
    };
  }
  const d = parsed.data.data;
  const daysLeft = daysUntil(d.expires_at, now);
  const expiresAt = d.expires_at ? new Date(d.expires_at * 1000).toISOString() : null;
  const personal = d.type === "USER";
  let message = personal
    ? "Token pessoal: funciona, mas depende da sua conta. Prefira um usuário do sistema."
    : "Token de usuário do sistema.";
  let ok = true;
  if (daysLeft !== null && daysLeft < 0) {
    ok = false;
    message = "Token vencido: os envios estão falhando. Substitua no Vault.";
  } else if (daysLeft !== null && daysLeft <= 15) {
    ok = false;
    message = `Token vence em ${daysLeft} dia(s): substitua no Vault antes disso.`;
  } else if (daysLeft !== null) {
    message += ` Vence em ${daysLeft} dias.`;
  }
  return { ok, type: d.type ?? null, expiresAt, daysLeft, appId: d.app_id ?? null, message };
}

export function interpretPixel(
  pixelId: string,
  raw: unknown,
  appId: string | null,
): MetaCheck["pixel"] {
  if (appId && pixelId === appId) {
    return {
      ok: false,
      name: null,
      business: null,
      message:
        "Esse número é o ID do app da Meta, não do Pixel. Copie o ID do conjunto de dados no Gerenciador de Eventos.",
    };
  }
  const ok = pixelSchema.safeParse(raw);
  if (ok.success && ok.data.id === pixelId) {
    return {
      ok: true,
      name: ok.data.name ?? null,
      business: ok.data.owner_business?.name ?? null,
      message: "Pixel encontrado e acessível pelo token.",
    };
  }
  const err = errorSchema.safeParse(raw);
  const code = err.success ? err.data.error.code : undefined;
  return {
    ok: false,
    name: null,
    business: null,
    message:
      code === 100
        ? "Esse ID não é de um Pixel (conjunto de dados) ou o token não o enxerga."
        : code === 190
          ? "Token inválido: não foi possível consultar o Pixel."
          : "O token não tem acesso a esse Pixel. Confira se ele pertence ao negócio Nexus Printi.",
  };
}

export async function checkMetaConnection(
  input: { pixelId: string; accessToken: string; graphApiVersion: string },
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<MetaCheck> {
  const base = `https://graph.facebook.com/${input.graphApiVersion}`;
  const get = async (path: string, params: Record<string, string>) => {
    const url = new URL(`${base}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
      return (await res.json().catch(() => null)) as unknown;
    } catch {
      return null;
    }
  };
  // O token vai como parâmetro só nestas consultas de leitura, servidor → Meta.
  const debug = await get("debug_token", {
    input_token: input.accessToken,
    access_token: input.accessToken,
  });
  const token = interpretToken(debug, now);
  const pixelRaw = await get(input.pixelId, {
    fields: "id,name,owner_business",
    access_token: input.accessToken,
  });
  const { appId, ...tokenView } = token;
  return { pixel: interpretPixel(input.pixelId, pixelRaw, appId), token: tokenView };
}
