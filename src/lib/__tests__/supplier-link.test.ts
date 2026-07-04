import { describe, it, expect } from "vitest";
import { domainFromUrl } from "@/lib/supplier-link";

describe("domainFromUrl (vínculo produto↔fornecedor)", () => {
  it("extrai o domínio sem www e em minúsculas", () => {
    expect(domainFromUrl("https://www.futuraim.com.br/produto/cartao?id=4627")).toBe("futuraim.com.br");
    expect(domainFromUrl("https://futuraim.com.br/x")).toBe("futuraim.com.br");
    expect(domainFromUrl("https://WWW.Example.COM/a")).toBe("example.com");
  });

  it("retorna null para entradas inválidas ou vazias", () => {
    expect(domainFromUrl(null)).toBeNull();
    expect(domainFromUrl(undefined)).toBeNull();
    expect(domainFromUrl("")).toBeNull();
    expect(domainFromUrl("não é uma url")).toBeNull();
  });
});
