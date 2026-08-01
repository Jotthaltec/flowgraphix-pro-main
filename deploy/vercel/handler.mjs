/**
 * Entrada da Serverless Function na Vercel.
 *
 * O esbuild empacota este arquivo (com o bundle SSR e as dependências dentro)
 * em `.vercel/output/functions/index.func/index.mjs`. Ver `scripts/build-vercel.mjs`.
 *
 * Assinatura clássica `(req, res)` do Node de propósito: é a que o runtime
 * nodejs da Vercel sempre suportou, sem depender da detecção de web handler.
 * Os estáticos não passam por aqui — são servidos de `.vercel/output/static`.
 */

import server from "../../dist/server/server.js";
import { sendWebResponse, toWebRequest } from "../shared/node-web-bridge.mjs";

export default async function handler(req, res) {
  try {
    const request = toWebRequest(req, { fallbackHost: process.env.VERCEL_URL ?? "localhost" });
    const webResponse = await server.fetch(request, process.env, undefined);
    await sendWebResponse(res, webResponse);
  } catch (error) {
    console.error("[flow-printi] falha ao atender request:", error);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    }
    res.end("Erro interno do servidor.");
  }
}
