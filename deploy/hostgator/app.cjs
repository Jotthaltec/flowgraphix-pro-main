/**
 * Adaptador Node para rodar o build SSR do TanStack Start dentro do
 * "Configurar Aplicativo Node.js" (Phusion Passenger) da HostGator.
 *
 * O build gera `dist/server/server.js` exportando `{ fetch(Request) => Response }`
 * — contrato Web padrão, pensado para Workers. Aqui traduzimos o req/res do Node
 * para esse contrato e servimos `dist/client` como estático (no Worker quem faz
 * isso é a plataforma; sob Passenger todo request chega no Node).
 *
 * O arquivo é .cjs de propósito: o package.json tem `"type": "module"` porque o
 * bundle do servidor é ESM, mas o Passenger carrega o startup file com require().
 * A extensão .cjs garante CommonJS aqui e `import()` dinâmico carrega o ESM.
 */

"use strict";

const http = require("node:http");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = __dirname;
const CLIENT_DIR = path.join(ROOT, "dist", "client");
const SERVER_ENTRY = path.join(ROOT, "dist", "server", "server.js");
const BRIDGE_ENTRY = path.join(ROOT, "node-web-bridge.mjs");
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

let depsPromise;

/**
 * O bundle SSR e a ponte são ESM; este arquivo é CJS. `import()` dinâmico é a
 * única forma de carregá-los daqui — e o resultado fica em cache no módulo.
 */
function getDeps() {
  if (!depsPromise) {
    depsPromise = Promise.all([
      import(pathToFileURL(SERVER_ENTRY).href).then((mod) => mod.default ?? mod),
      import(pathToFileURL(BRIDGE_ENTRY).href),
    ]).then(([entry, bridge]) => ({ entry, bridge }));
  }
  return depsPromise;
}

/**
 * Serve um arquivo de dist/client. Retorna false quando não há arquivo
 * correspondente — aí o request segue para o SSR.
 */
async function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  let relative;
  try {
    relative = decodeURIComponent(pathname);
  } catch {
    return false;
  }

  const file = path.resolve(CLIENT_DIR, `.${path.posix.normalize(relative)}`);
  // Barreira contra path traversal: só serve o que está dentro de dist/client.
  if (file !== CLIENT_DIR && !file.startsWith(CLIENT_DIR + path.sep)) return false;

  let stat;
  try {
    stat = await fsp.stat(file);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;

  const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  // Os nomes em /assets carregam hash de conteúdo, então podem ser imutáveis.
  const cacheControl = pathname.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600";

  res.writeHead(200, {
    "content-type": type,
    "content-length": stat.size,
    "cache-control": cacheControl,
    "last-modified": stat.mtime.toUTCString(),
  });

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  const handle = await fsp.open(file, "r");
  handle.createReadStream({ autoClose: true }).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, "http://localhost");
    if (await serveStatic(req, res, pathname)) return;

    const { entry, bridge } = await getDeps();
    const request = bridge.toWebRequest(req, { fallbackHost: `localhost:${PORT}` });
    const webResponse = await entry.fetch(request, process.env, undefined);
    await bridge.sendWebResponse(res, webResponse);
  } catch (error) {
    console.error("[flow-printi] falha ao atender request:", error);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    }
    res.end("Erro interno do servidor.");
  }
});

server.listen(PORT, () => {
  console.log(`[flow-printi] SSR ouvindo na porta ${PORT}`);
});
