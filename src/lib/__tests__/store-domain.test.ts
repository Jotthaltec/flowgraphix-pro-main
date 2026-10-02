import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ORDER_STATUS_META, QUOTE_STATUS_META } from "@/lib/store-domain";
import { TONE_VARIANT } from "@/lib/store-domain-ui";

// Ignora formatação (o lint pode quebrar linhas ou trocar vírgulas).
const normalize = (s: string) => s.replace(/\s|,/g, "");
const site = resolve(__dirname, "../../../../Nexus-Printi/src/lib/domain.ts");
const copy = resolve(__dirname, "../store-domain.ts");

describe("store-domain", () => {
  it.skipIf(!existsSync(site))(
    "é igual ao domínio do site (rode scripts/sync-store-domain.mjs)",
    () => {
      const body = readFileSync(copy, "utf8").replace(/^\/\* Cópia de[\s\S]*?\*\/\s*/, "");
      expect(normalize(body)).toBe(normalize(readFileSync(site, "utf8")));
    },
  );

  it("toda cor do site tem variante de badge", () => {
    for (const meta of [...Object.values(ORDER_STATUS_META), ...Object.values(QUOTE_STATUS_META)]) {
      expect(TONE_VARIANT[meta.tone]).toBeTruthy();
    }
  });
});
