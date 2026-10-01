import { describe, expect, it } from "vitest";
import { hasBearerSecret } from "@/lib/bearer-auth.server";

const req = (auth?: string) =>
  new Request("https://flow.test/api", { headers: auth ? { authorization: auth } : {} });

describe("hasBearerSecret", () => {
  it("aceita só o segredo exato", () => {
    expect(hasBearerSecret(req("Bearer s3gr3do-longo"), "s3gr3do-longo")).toBe(true);
    expect(hasBearerSecret(req("bearer s3gr3do-longo"), "s3gr3do-longo")).toBe(true);
    expect(hasBearerSecret(req("Bearer s3gr3do-longX"), "s3gr3do-longo")).toBe(false);
    expect(hasBearerSecret(req("Bearer curto"), "s3gr3do-longo")).toBe(false);
  });
  it("sem cabeçalho ou sem variável configurada ninguém passa", () => {
    expect(hasBearerSecret(req(), "s3gr3do-longo")).toBe(false);
    expect(hasBearerSecret(req("Bearer qualquer"), undefined)).toBe(false);
    expect(hasBearerSecret(req("Bearer "), "")).toBe(false);
  });
});
