/**
 * Gerador de Copys de Marketplace com Foco em SEO e Alta Conversão
 * Suporta geração de múltiplos anúncios por variação de produto
 */

export interface MarketplaceCopy {
  title: string;
  description: string;
  price: number;
  keywords: string[];
  /** Identifica a combinação de variações deste anúncio */
  variationLabel: string;
  /** Quantidade desta tiragem (ex: 100, 250, 500) */
  quantity?: number;
}

export interface VariationOption {
  key: string;   // Ex: "Tiragem", "Cor", "Material", "Formato"
  value: string; // Ex: "100 unidades", "4x0 Frente", "Couchê Fosco 300g"
}

export interface ProductVariationCombo {
  label: string;           // Ex: "100 un · Frente · Couchê 300g"
  quantity?: number;
  price: number;           // Custo do fornecedor para esta combinação
  sellPrice: number;       // Preço de venda sugerido
  variations: VariationOption[];
}

/**
 * Gera combinações de anúncios a partir de tiragens e variações selecionadas
 */
export function buildVariationCombos(
  quantityPrices: Array<{ quantity: number; price: number; sellPrice?: number; unitPrice?: number }>,
  selectedVariations: Record<string, string[]>, // Ex: { "Cor": ["4x0", "4x4"], "Material": ["Couchê 300g"] }
  marginPercent: number
): ProductVariationCombo[] {
  const combos: ProductVariationCombo[] = [];

  // Monta os grupos de variações selecionadas (excluindo grupos vazios)
  const varKeys = Object.keys(selectedVariations).filter(k => selectedVariations[k].length > 0);

  // Se não há variações, gera um anúncio por tiragem
  if (varKeys.length === 0) {
    for (const qp of quantityPrices) {
      const sellPrice = qp.sellPrice ?? parseFloat((qp.price * (1 + marginPercent / 100)).toFixed(2));
      combos.push({
        label: `${qp.quantity} unidades`,
        quantity: qp.quantity,
        price: qp.price,
        sellPrice,
        variations: [{ key: "Tiragem", value: `${qp.quantity} unidades` }]
      });
    }
    return combos;
  }

  // Gera o produto cartesiano das variações selecionadas
  const cartesian = (arrays: string[][]): string[][] => {
    return arrays.reduce<string[][]>(
      (acc, curr) => acc.flatMap(a => curr.map(b => [...a, b])),
      [[]]
    );
  };

  const varValues = varKeys.map(k => selectedVariations[k]);
  const varCombinations = cartesian(varValues);

  // Para cada tiragem × cada combinação de variações
  for (const qp of quantityPrices) {
    const sellPrice = qp.sellPrice ?? parseFloat((qp.price * (1 + marginPercent / 100)).toFixed(2));

    for (const combo of varCombinations) {
      const varList: VariationOption[] = combo.map((val, idx) => ({
        key: varKeys[idx],
        value: val
      }));

      const labelParts = [
        `${qp.quantity} un`,
        ...combo
      ];

      combos.push({
        label: labelParts.join(" · "),
        quantity: qp.quantity,
        price: qp.price,
        sellPrice,
        variations: [
          { key: "Tiragem", value: `${qp.quantity} unidades` },
          ...varList
        ]
      });
    }
  }

  return combos;
}

/**
 * Gera a copy de marketplace para uma combinação de variação específica
 */
export function generateMarketplaceCopy(
  platform: string,
  productName: string,
  costPrice: number,
  marginPercent: number,
  specifications: Record<string, string>,
  productionDeadline: string,
  combo?: ProductVariationCombo
): MarketplaceCopy {
  const calculatedPrice = combo?.sellPrice ?? parseFloat((costPrice * (1 + marginPercent / 100)).toFixed(2));
  const varLabel = combo?.label ?? "Padrão";
  const qty = combo?.quantity;

  // Limpa o nome do produto de termos técnicos desnecessários
  let baseTitle = productName.replace(/(?:fornecedor|zap|printi|card|atual|gabarito|cdr|pdf|original)/gi, "").trim();

  // Enriquece o título com a variação
  let varTitleSuffix = "";
  if (combo?.variations) {
    // Remove "Tiragem" do sufixo do título — ela vai no começo
    const varParts = combo.variations
      .filter(v => v.key !== "Tiragem")
      .map(v => v.value);
    if (varParts.length > 0) varTitleSuffix = " " + varParts.join(" ");
  }

  const qtyText = qty ? `${qty} Unidades ` : "";

  // Palavras-chave baseadas no produto e variações
  const keywords: string[] = [
    baseTitle.toLowerCase(),
    "grafica rapida",
    "personalizado",
    "impressao de alta qualidade",
    "comunicacao visual",
  ];
  if (combo?.variations) {
    combo.variations.forEach(v => {
      if (v.value) keywords.push(v.value.toLowerCase());
    });
  }
  Object.keys(specifications).forEach(key => {
    if (specifications[key]) keywords.push(specifications[key].toLowerCase());
  });

  // Monta as especificações da variação atual
  const comboSpecsText = combo?.variations
    ? combo.variations.map(v => `• ${v.key}: ${v.value}`).join("\n")
    : "";

  const baseSpecsText = Object.entries(specifications)
    .filter(([k]) => !combo?.variations?.some(v => v.key === k)) // evita repetição
    .map(([key, val]) => `• ${key}: ${val}`)
    .join("\n");

  const allSpecsText = [comboSpecsText, baseSpecsText].filter(Boolean).join("\n");

  let title = "";
  let description = "";

  switch (platform.toLowerCase()) {
    case "mercado_livre":
      title = `${qtyText}${baseTitle}${varTitleSuffix} Personalizado Gráfica`.substring(0, 60);
      description = `⚡ ${qtyText.toUpperCase()}${productName.toUpperCase()}${varTitleSuffix.toUpperCase()} ⚡

Destaque seu negócio com impressão de alta qualidade! ${qty ? `Anúncio referente à tiragem de ${qty} unidades.` : ""}

🎯 ESPECIFICAÇÕES DO PRODUTO:
${allSpecsText || "• Material Premium com acabamento profissional\n• Cores vibrantes de alta fidelidade"}

⏱️ PRAZO DE PRODUÇÃO:
• Apenas ${productionDeadline || "5 dias úteis"} após aprovação da arte!

📦 POR QUE COMPRAR CONOSCO?
• Compra 100% segura e garantida pelo Mercado Livre
• Atendimento personalizado pós-venda
• Embalagem ultra resistente para garantir a integridade do material

⚠️ IMPORTANTE:
Após a confirmação do pagamento, nossa equipe entrará em contato via chat para combinar o envio da arte.`;
      break;

    case "shopee":
      title = `🔥 ${qtyText}${baseTitle}${varTitleSuffix} Personalizado Premium Alta Qualidade 🔥`.substring(0, 150);
      description = `🛒 GRÁFICA RÁPIDA PREMIUM NA SHOPEE! 🛒

${qty ? `🎯 Este anúncio é referente à tiragem de ${qty} unidades.` : ""}

✨ Detalhes do Produto:
${allSpecsText || "• Impressão de alta fidelidade fotográfica\n• Acabamento de primeira linha"}

🚚 Prazo de Produção:
• Produzido em até ${productionDeadline || "5 dias úteis"} após envio da arte!

💡 Dúvidas Frequentes:
1. Como envio minha arte? R: Pelo chat da Shopee após o pagamento.
2. Vocês criam o layout? R: Checagem técnica gratuita incluída!

#grafica #comunicacaovisual #personalizado #brindes #marketing`;
      break;

    case "nuvemshop":
      title = `${qtyText}${baseTitle}${varTitleSuffix} Personalizado para Sua Marca`;
      description = `<p>Adicione um toque de profissionalismo com o nosso <strong>${qtyText}${baseTitle}${varTitleSuffix} Personalizado</strong>.</p>
      
      <h3>📋 Detalhes do Produto:</h3>
      <ul>
        ${combo?.variations?.map(v => `<li><strong>${v.key}:</strong> ${v.value}</li>`).join("\n") ?? ""}
        ${Object.entries(specifications).map(([key, val]) => `<li><strong>${key}:</strong> ${val}</li>`).join("\n") || `<li>Impressão de alta resolução</li>`}
      </ul>

      <h3>⏱️ Prazo de Produção:</h3>
      <p>Prazo de <strong>${productionDeadline || "5 dias úteis"}</strong> após aprovação do arquivo de arte.</p>

      <h3>🎨 Envio de Arquivos:</h3>
      <p>Envie seus arquivos em PDF/X-1a, CDR, AI ou PSD após a compra. Revisamos gratuitamente!</p>`;
      break;

    case "woocommerce":
      title = `${qtyText}${baseTitle}${varTitleSuffix} Personalizado de Alta Qualidade`;
      description = `<div class="product-description-container">
        <h2>${qtyText}${baseTitle}${varTitleSuffix} Personalizado</h2>
        <p>Qualidade excepcional e excelente custo-benefício. ${qty ? `Anúncio para tiragem de ${qty} unidades.` : ""}</p>
        
        <h3>Especificações Técnicas:</h3>
        <table class="table-product-specs" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tbody>
            ${combo?.variations?.map(v => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; font-weight: bold; width: 30%;">${v.key}</td>
                <td style="padding: 8px;">${v.value}</td>
              </tr>
            `).join("\n") ?? ""}
            ${Object.entries(specifications).filter(([k]) => !combo?.variations?.some(v => v.key === k)).map(([key, val]) => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; font-weight: bold; width: 30%;">${key}</td>
                <td style="padding: 8px;">${val}</td>
              </tr>
            `).join("\n") || `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; font-weight: bold;">Impressão</td>
                <td style="padding: 8px;">Alta Resolução OffSet/Digital</td>
              </tr>
            `}
          </tbody>
        </table>

        <h3 style="margin-top: 20px;">Prazo de Produção:</h3>
        <p>Prazo de fabricação de <strong>${productionDeadline || "5 dias úteis"}</strong>.</p>
      </div>`;
      break;
  }

  return {
    title,
    description,
    price: calculatedPrice,
    keywords: keywords.slice(0, 10),
    variationLabel: varLabel,
    quantity: qty,
  };
}
