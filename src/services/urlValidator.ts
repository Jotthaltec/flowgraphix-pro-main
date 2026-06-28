/**
 * Validação de URL e proteção anti-SSRF do importador (seção 4).
 *
 * Módulo puro (sem dependências de servidor) para poder ser reutilizado tanto
 * pela server function quanto pelo frontend e pelos testes.
 */

export const ALLOWED_DOMAINS = ["futuraim.com.br", "www.futuraim.com.br"];

// Padrões de host bloqueados explicitamente (defesa em profundidade — a
// allowlist já cobre, mas mantemos os bloqueios pedidos na spec).
const BLOCKED_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^0\.0\.0\.0$/,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./, // link-local
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

export interface ValidateResult {
  ok: boolean;
  url?: string;
  domain?: string;
  reason?: string;
}

/** Valida uma URL de fornecedor (HTTPS-only + allowlist + bloqueio interno). */
export function validateSupplierUrl(rawUrl: string): ValidateResult {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { ok: false, reason: "URL vazia." };
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, reason: "URL inválida." };
  }

  // Apenas HTTPS — bloqueia http/file/ftp/javascript/data.
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: `Protocolo não permitido: ${parsed.protocol} (use HTTPS).` };
  }

  const host = parsed.hostname.toLowerCase();

  if (isIpLiteral(host)) {
    return { ok: false, reason: "Endereços IP literais não são permitidos." };
  }
  if (BLOCKED_HOST_PATTERNS.some((re) => re.test(host))) {
    return { ok: false, reason: "Host interno/privado bloqueado." };
  }

  const domain = host.replace(/^www\./, "");
  const allowed = ALLOWED_DOMAINS.some((d) => host === d || host === `www.${d}` || domain === d);
  if (!allowed) {
    return { ok: false, reason: `Domínio não permitido: ${host}. Permitidos: ${ALLOWED_DOMAINS.join(", ")}.` };
  }

  return { ok: true, url: parsed.toString(), domain };
}
