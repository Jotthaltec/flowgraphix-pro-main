import { describe, it, expect } from "vitest";
import { validateSupplierUrl, normalizeAllowlist, ALLOWED_DOMAINS } from "@/services/urlValidator";

describe("urlValidator — allowlist data-driven (motor universal)", () => {
  it("sem opções, mantém a allowlist padrão (FuturaIM)", () => {
    expect(validateSupplierUrl("https://futuraim.com.br/produto/x").ok).toBe(true);
    expect(validateSupplierUrl("https://fornecedor-novo.com/p").ok).toBe(false);
  });

  it("aceita um domínio customizado quando ele está na allowlist", () => {
    const res = validateSupplierUrl("https://fornecedor-novo.com/p", {
      allowedDomains: ["fornecedor-novo.com"],
    });
    expect(res.ok).toBe(true);
    expect(res.domain).toBe("fornecedor-novo.com");
  });

  it("aceita www. e normaliza para o domínio-base", () => {
    const res = validateSupplierUrl("https://www.grafica-x.com.br/prod", {
      allowedDomains: ["grafica-x.com.br"],
    });
    expect(res.ok).toBe(true);
    expect(res.domain).toBe("grafica-x.com.br");
  });

  it("rejeita domínio fora da allowlist customizada", () => {
    const res = validateSupplierUrl("https://outro.com/p", { allowedDomains: ["grafica-x.com.br"] });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/não permitido/i);
  });

  it("anti-SSRF SEMPRE aplicado, mesmo com allowlist liberando o host", () => {
    // http bloqueado
    expect(validateSupplierUrl("http://grafica-x.com.br/p", { allowedDomains: ["grafica-x.com.br"] }).ok).toBe(false);
    // IP interno bloqueado ainda que "liberado"
    expect(validateSupplierUrl("https://127.0.0.1/p", { allowedDomains: ["127.0.0.1"] }).ok).toBe(false);
    expect(validateSupplierUrl("https://192.168.0.10/p", { allowedDomains: ["192.168.0.10"] }).ok).toBe(false);
    expect(validateSupplierUrl("https://localhost/p", { allowedDomains: ["localhost"] }).ok).toBe(false);
  });

  it("normalizeAllowlist: vazio → padrão; remove www/duplicatas", () => {
    expect(normalizeAllowlist(undefined)).toBe(ALLOWED_DOMAINS);
    expect(normalizeAllowlist([])).toBe(ALLOWED_DOMAINS);
    expect(normalizeAllowlist(["www.A.com", "a.com", "B.com"]).sort()).toEqual(["a.com", "b.com"]);
  });
});
