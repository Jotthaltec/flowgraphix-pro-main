import { timingSafeEqual } from "node:crypto";

/**
 * Confere `Authorization: Bearer <segredo>` contra uma variável de ambiente,
 * em tempo constante. Sem a variável configurada, ninguém passa.
 */
export function hasBearerSecret(request: Request, expected: string | undefined): boolean {
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}
