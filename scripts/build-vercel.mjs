/**
 * Gera `.vercel/output/` no formato Build Output API v3 a partir do build do
 * TanStack Start.
 *
 * Por que não deixar a Vercel detectar sozinha: o build gera `dist/client`
 * (só assets, sem nenhum index.html) e `dist/server/server.js`, que é um
 * handler `fetch(Request) => Response`. Sem adaptador a Vercel não encontra
 * nada para servir e toda rota vira 404 NOT_FOUND.
 *
 * Aqui o empacotamento é explícito: nós mesmos rodamos o esbuild, então não
 * depende da ordem em que a Vercel constrói `api/` nem da detecção de framework.
 *
 * Rode depois do `vite build` — ver o script `build:vercel` no package.json.
 */

import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT_DIR = path.join(ROOT, "dist", "client");
const SERVER_ENTRY = path.join(ROOT, "dist", "server", "server.js");
const OUTPUT = path.join(ROOT, ".vercel", "output");
const FUNCTION_DIR = path.join(OUTPUT, "functions", "index.func");

// Precisa bater com o runtime declarado em .vc-config.json.
const NODE_MAJOR = 22;

async function assertBuilt() {
  for (const target of [CLIENT_DIR, SERVER_ENTRY]) {
    try {
      await fs.stat(target);
    } catch {
      throw new Error(
        `${path.relative(ROOT, target)} não existe. Rode o "vite build" antes deste script.`,
      );
    }
  }
}

async function main() {
  await assertBuilt();

  await fs.rm(OUTPUT, { recursive: true, force: true });
  await fs.mkdir(FUNCTION_DIR, { recursive: true });

  // Estáticos: a Vercel serve direto da CDN, sem passar pela function.
  await fs.cp(CLIENT_DIR, path.join(OUTPUT, "static"), { recursive: true });

  await build({
    entryPoints: [path.join(ROOT, "deploy", "vercel", "handler.mjs")],
    outfile: path.join(FUNCTION_DIR, "index.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: `node${NODE_MAJOR}`,
    minify: true,
    // A function sobe sozinha, sem node_modules ao lado: tudo entra no bundle.
    packages: "bundle",
    // O `"sideEffects": false` do package.json descreve o código-fonte, mas o
    // esbuild o aplicaria também a dist/server/*, descartando os `import "./chunk.js"`
    // que o Rollup emite justamente para preservar ordem de inicialização.
    ignoreAnnotations: true,
    // Dependências em CJS que chamam require() em runtime não têm esse binding
    // dentro de um módulo ESM — o shim devolve ele.
    banner: {
      js: [
        "import { createRequire as __createRequire } from 'node:module';",
        "const require = __createRequire(import.meta.url);",
      ].join("\n"),
    },
    logLevel: "warning",
  });

  await fs.writeFile(
    path.join(FUNCTION_DIR, ".vc-config.json"),
    JSON.stringify(
      {
        runtime: `nodejs${NODE_MAJOR}.x`,
        handler: "index.mjs",
        launcherType: "Nodejs",
        // O handler escreve direto no `res`; não queremos os helpers do Vercel.
        shouldAddHelpers: false,
        supportsResponseStreaming: true,
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    path.join(OUTPUT, "config.json"),
    JSON.stringify(
      {
        version: 3,
        routes: [
          // Os nomes em /assets carregam hash de conteúdo: podem ser imutáveis.
          {
            src: "^/assets/(.*)$",
            headers: { "cache-control": "public, max-age=31536000, immutable" },
            continue: true,
          },
          // Arquivo estático existente ganha do SSR.
          { handle: "filesystem" },
          { src: "^/.*$", dest: "/index" },
        ],
      },
      null,
      2,
    ),
  );

  const { size } = await fs.stat(path.join(FUNCTION_DIR, "index.mjs"));
  console.log(
    `[build-vercel] .vercel/output pronto — function com ${(size / 1024 / 1024).toFixed(2)} MB`,
  );
}

await main();
