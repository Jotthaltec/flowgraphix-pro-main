/**
 * Ponte entre o `req`/`res` do Node e o contrato Web (`Request`/`Response`) que
 * o bundle SSR do TanStack Start expõe.
 *
 * Usada pelos dois destinos de deploy, para a tradução não divergir entre eles:
 *  - `deploy/hostgator/app.cjs` — Passenger na hospedagem compartilhada
 *  - `deploy/vercel/handler.mjs` — Serverless Function na Vercel
 */

import { Readable } from "node:stream";

export function toWebRequest(req, { fallbackHost = "localhost" } = {}) {
  const host = req.headers.host ?? fallbackHost;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto ?? "https")
    .split(",")[0]
    .trim();

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((entry) => headers.append(key, entry));
    else headers.set(key, value);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  return new Request(new URL(req.url, `${proto}://${host}`), {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    // Exigido pelo undici quando o corpo é um stream.
    duplex: hasBody ? "half" : undefined,
    redirect: "manual",
  });
}

export async function sendWebResponse(res, webResponse) {
  const headers = {};
  for (const [key, value] of webResponse.headers) headers[key] = value;

  // Vários Set-Cookie colapsam em uma string só na iteração acima; o
  // getSetCookie() devolve a lista real (auth do Supabase depende disso).
  const setCookie =
    typeof webResponse.headers.getSetCookie === "function"
      ? webResponse.headers.getSetCookie()
      : [];
  if (setCookie.length > 0) headers["set-cookie"] = setCookie;

  res.writeHead(webResponse.status, headers);

  if (!webResponse.body) {
    res.end();
    return;
  }
  Readable.fromWeb(webResponse.body).pipe(res);
}
