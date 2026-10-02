// Copia o dicionário de domínio do site (Nexus-Printi/src/lib/domain.ts) para o
// CRM. O site é a referência: status, rótulos, cores e etapas de pedidos,
// orçamentos, produção, pagamento, entrega e arte. Rode após mudar o arquivo
// do site:  node scripts/sync-store-domain.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "../Nexus-Printi/src/lib/domain.ts");
const target = resolve(root, "src/lib/store-domain.ts");

const header = `/* Cópia de Nexus-Printi/src/lib/domain.ts — NÃO editar aqui.
   O site é a referência do domínio da loja; atualize lá e rode
   \`node scripts/sync-store-domain.mjs\`. O teste store-domain.test.ts acusa divergência. */

`;
writeFileSync(target, header + readFileSync(source, "utf8"));
console.log(`atualizado: ${target}`);
