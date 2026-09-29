import { describe, expect, it } from "vitest";
import { classifySupabaseUrl, productionBuildProblem } from "@/lib/app-env";

const PROD = "https://gkbbzypdakjrvxwvfjlc.supabase.co";

describe("classifySupabaseUrl", () => {
  it("reconhece o projeto de produção", () => {
    expect(classifySupabaseUrl(PROD)).toBe("producao");
    expect(classifySupabaseUrl(`${PROD}/`)).toBe("producao");
  });

  it.each([
    "http://127.0.0.1:54321",
    "http://localhost:54321",
    "http://[::1]:54321",
    "http://0.0.0.0:54321",
    "http://api.localhost",
  ])("trata %s como banco local", (url) => {
    expect(classifySupabaseUrl(url)).toBe("local");
  });

  it("trata outro projeto Supabase como homologação", () => {
    expect(classifySupabaseUrl("https://abcdefghijklmnop.supabase.co")).toBe("homologacao");
  });

  it("não adivinha quando a URL falta ou é inválida", () => {
    expect(classifySupabaseUrl(undefined)).toBe("desconhecido");
    expect(classifySupabaseUrl("  ")).toBe("desconhecido");
    expect(classifySupabaseUrl("sua-url-aqui")).toBe("desconhecido");
    expect(classifySupabaseUrl("https://gkbbzypdakjrvxwvfjlc.supabase.co.evil.com")).toBe(
      "desconhecido",
    );
  });
});

describe("productionBuildProblem", () => {
  it("libera quando todas as URLs apontam para produção", () => {
    expect(productionBuildProblem({ VITE_SUPABASE_URL: PROD, SUPABASE_URL: PROD })).toBeNull();
    expect(productionBuildProblem({ VITE_SUPABASE_URL: PROD, SUPABASE_URL: undefined })).toBeNull();
  });

  it("recusa quando qualquer URL aponta para localhost", () => {
    const problem = productionBuildProblem({
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_URL: PROD,
    });
    expect(problem).toContain("VITE_SUPABASE_URL=http://127.0.0.1:54321 (local)");
    expect(problem).not.toContain("SUPABASE_URL=https");
  });

  it("recusa homologação publicada como produção", () => {
    expect(
      productionBuildProblem({ VITE_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co" }),
    ).toContain("(homologacao)");
  });

  it("recusa build sem nenhuma URL configurada", () => {
    expect(productionBuildProblem({ VITE_SUPABASE_URL: undefined, SUPABASE_URL: "" })).toMatch(
      /nenhuma URL/,
    );
  });
});
