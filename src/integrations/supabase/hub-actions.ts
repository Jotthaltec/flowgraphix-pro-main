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

      return { success: true, html, domain };
    } catch (error: any) {
      console.error("Erro no processamento da Server Function fetchProductHtml:", error);
      return { success: false, error: error.message || "Erro desconhecido ao obter conteúdo da página" };
    }
  });

// ==========================================
// 2. Extração de Produto via IA (Fallback Claude Haiku)
// ==========================================
export const extractProductWithAI = createServerFn({ method: "POST" })
  .inputValidator((data: { html: string; url: string }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { success: false, error: "ANTHROPIC_API_KEY não configurada no servidor." };
    }

    // Limpa o HTML e pega os primeiros 8000 chars de texto visível
    const pageText = data.html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .substring(0, 8000);

    const prompt = `Você é um extrator especializado em produtos gráficos brasileiros. Analise o texto abaixo de uma página de fornecedor gráfico e extraia as informações do produto.

URL: ${data.url}

TEXTO DA PÁGINA:
${pageText}

Retorne APENAS um JSON válido com esta estrutura exata (sem markdown, sem explicações extras):
{
  "product_name": "nome completo do produto",
  "supplier_sku": "código SKU do fornecedor ou null",
  "category": "categoria (ex: Cartão de Visita, Panfleto, Banner, Folder, Adesivo)",
  "subcategory": "subcategoria ou null",
  "current_price": 0.00,
  "original_price": 0.00,
  "production_deadline": "prazo de produção (ex: 5 dias úteis)",
  "specifications": { "Chave": "Valor" },
  "quantity_prices": [
    { "quantity": 100, "price": 0.00 }
  ]
}

Regras importantes:
- current_price é o PREÇO DE CUSTO do fornecedor (preço base ou menor tiragem disponível)
- quantity_prices: extraia a tabela de preços por tiragem se disponível na página
- specifications: extraia características técnicas (papel, gramatura, acabamento, formato, impressão, etc.)
- Preços sempre numéricos sem símbolo (ex: 97.99 e não "R$ 97,99")
- Se não encontrar um campo, use null para strings e 0 para números`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return { success: false, error: `Erro na API Anthropic: ${errText}` };
      }

      const result = await response.json();
      const text = result.content?.[0]?.text || "";

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { success: false, error: "IA não retornou JSON válido." };
      }

      const extracted = JSON.parse(jsonMatch[0]);
      return { success: true, data: extracted };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });
