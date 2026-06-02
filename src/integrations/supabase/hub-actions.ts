import { createServerFn } from "@tanstack/react-start";

// ==========================================
// 1. Fetch de HTML de Página Pública (Server-Side Bypass CORS)
// ==========================================
export const fetchProductHtml = createServerFn({ method: "POST" })
  .inputValidator((data: { url: string }) => data)
  .handler(async ({ data }) => {
    const { url } = data;
    try {
      if (!url) throw new Error("A URL é obrigatória.");

      // Faz fetch do HTML da página pública no servidor para contornar restrições de CORS do navegador
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        }
      });

      if (!response.ok) {
        throw new Error(`Falha ao acessar o link do fornecedor (${response.status})`);
      }

      const html = await response.text();
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname.replace("www.", "");

      return {
        success: true,
        html,
        domain
      };
    } catch (error: any) {
      console.error("Erro no processamento da Server Function fetchProductHtml:", error);
      return {
        success: false,
        error: error.message || "Erro desconhecido ao obter conteúdo da página"
      };
    }
  });
