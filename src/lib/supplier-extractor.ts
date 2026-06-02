/**
 * Motor de Extração de Dados Públicos do Hub de Fornecedores
 * Implementa métodos robustos para parsing de HTML de e-commerce gráfico.
 */

export interface ExtractedProductData {
  product_name: string;
  supplier_sku: string;
  category: string;
  subcategory: string;
  main_image_url: string;
  gallery_images: string[];
  original_price: number;
  current_price: number;
  discount_percent: number;
  production_deadline: string;
  specifications: Record<string, string>;
  variations: Array<{ name: string; values: string[] }>;
  quantity_prices: Array<{ quantity: number; price: number; unitPrice: number; sellPrice?: number; unitSellPrice?: number }>;
  extra_services: Array<{ name: string; price: number }>;
  template_links: Array<{ name: string; url: string }>;
  raw_text_sample: string;
}

export function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;
  
  // Limpa R$, espaços e caracteres não numéricos básicos, mantendo pontos e vírgulas
  let cleaned = priceStr.replace(/R\$\s*/gi, "").replace(/\s/g, "");
  
  // Caso 1: Formato internacional puro (ex: 97.99 ou 1097.99)
  // Contém ponto mas não contém vírgula
  if (cleaned.includes(".") && !cleaned.includes(",")) {
    const parts = cleaned.split(".");
    if (parts.length === 2 && (parts[1].length === 2 || parts[1].length === 1)) {
      const val = parseFloat(cleaned);
      return isNaN(val) ? 0 : val;
    }
  }
  
  // Caso 2: Formato internacional com separador de milhar (ex: 1,299.99)
  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.indexOf(",") < cleaned.indexOf(".")) {
      cleaned = cleaned.replace(/,/g, ""); // remove vírgula de milhar
      const val = parseFloat(cleaned);
      return isNaN(val) ? 0 : val;
    }
  }
  
  // Caso 3: Formato brasileiro (ex: 97,99 ou 1.285,90)
  // Substitui pontos de milhar por nada e vírgula por ponto decimal
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
  } else {
    // Se não tiver vírgula e tiver ponto que não se encaixa no internacional, pode ser milhar brasileiro truncado
    // Tratamos com parseFloat padrão por segurança
  }
  
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

export function extractProductFromHtml(html: string, rules: any[] = []): ExtractedProductData {
  const result: ExtractedProductData = {
    product_name: "",
    supplier_sku: "",
    category: "Impressos",
    subcategory: "Geral",
    main_image_url: "",
    gallery_images: [],
    original_price: 0,
    current_price: 0,
    discount_percent: 0,
    production_deadline: "5 dias úteis",
    specifications: {},
    variations: [],
    quantity_prices: [],
    extra_services: [],
    template_links: [],
    raw_text_sample: "",
  };

  // Instancia o DOMParser no navegador para processamento nativo de seletores CSS
  let doc: Document | null = null;
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      doc = parser.parseFromString(html, "text/html");
    } catch (e) {
      console.error("Erro ao instanciar DOMParser no extrator:", e);
    }
  }

  // 1. Amostra de texto bruto para treinamento (remove scripts e tags)
  result.raw_text_sample = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .substring(0, 3000);

  // 2. Extração via Regras Customizadas (se fornecidas)
  if (rules && rules.length > 0) {
    for (const rule of rules) {
      if (!rule.active) continue;
      const value = applyExtractionRule(html, rule, doc);
      if (value) {
        mapFieldToResult(result, rule.field_key, value, rule);
      }
    }
  }

  // 3. Fallbacks Automáticos Inteligentes (caso os campos essenciais estejam vazios)

  // =========================================================================
  // 3. FALLBACKS AUTOMÁTICOS INTELIGENTES (Meta Tags e JSON-LD primeiro)
  // =========================================================================

  // A. EXTRAÇÃO DE DADOS ESTRUTURADOS DE CABEÇALHO (Meta Tags padrão de e-commerce)
  if (doc) {
    // Título
    const metaTitle = doc.querySelector("meta[property='og:title'], meta[name='title'], meta[name='twitter:title']");
    if (metaTitle && metaTitle.getAttribute("content") && !result.product_name) {
      result.product_name = decodeHtmlEntities(metaTitle.getAttribute("content") || "");
    }
    
    // Imagem
    const metaImg = doc.querySelector("meta[property='og:image'], meta[name='twitter:image'], meta[property='og:image:secure_url']");
    if (metaImg && metaImg.getAttribute("content") && !result.main_image_url) {
      result.main_image_url = metaImg.getAttribute("content") || "";
    }
    
    // Preço
    const metaPrice = doc.querySelector("meta[property='product:price:amount'], meta[property='og:price:amount'], meta[name='price']");
    if (metaPrice && metaPrice.getAttribute("content") && !result.current_price) {
      result.current_price = parsePrice(metaPrice.getAttribute("content") || "");
    }
    
    // SKU / ID do fornecedor
    const metaSku = doc.querySelector("meta[property='product:retailer_item_id'], meta[property='product:sku'], meta[name='sku'], meta[name='product_id']");
    if (metaSku && metaSku.getAttribute("content") && !result.supplier_sku) {
      result.supplier_sku = metaSku.getAttribute("content") || "";
    }
  }

  // B. EXTRAÇÃO DE JSON-LD (Produtos estruturados de schema.org)
  try {
    const jsonLdMatches = html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of jsonLdMatches) {
      const cleanJson = match[1].trim();
      const parsed = JSON.parse(cleanJson);
      
      const objects = Array.isArray(parsed) ? parsed : [parsed];
      for (const obj of objects) {
        const type = obj["@type"];
        if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) {
          if (obj.name && !result.product_name) result.product_name = decodeHtmlEntities(obj.name);
          if (obj.sku && !result.supplier_sku) result.supplier_sku = String(obj.sku);
          if (obj.image) {
            const images = Array.isArray(obj.image) ? obj.image : [obj.image];
            // Imagem principal
            if (!result.main_image_url && images[0]) {
              result.main_image_url = typeof images[0] === "string" ? images[0] : images[0]?.url || "";
            }
            // Galeria com todas as imagens do JSON-LD
            images.forEach((img: any) => {
              const imgUrl = typeof img === "string" ? img : img?.url || "";
              if (imgUrl && !result.gallery_images.includes(imgUrl)) {
                result.gallery_images.push(imgUrl);
              }
            });
          }
          if (obj.description && !result.specifications["Descrição"]) {
            result.specifications["Descrição"] = cleanText(obj.description);
          }
          // Descrição longa também pode vir em "disambiguatingDescription"
          if (obj.disambiguatingDescription && !result.specifications["Detalhes"]) {
            result.specifications["Detalhes"] = cleanText(obj.disambiguatingDescription);
          }
          
          // Preço nas ofertas do JSON-LD
          if (obj.offers) {
            const offer = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;
            if (offer.price && !result.current_price) {
              result.current_price = parseFloat(offer.price);
            }
          }
        }
      }
    }
  } catch (e) {
    // ignora erros de JSON-LD malformado no HTML
  }

  // C. FALLBACKS DE SEGUNDO NÍVEL (Caso meta-tags e JSON-LD não tenham preenchido tudo)

  // Fallback de Nome
  if (!result.product_name) {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      result.product_name = cleanText(h1Match[1]);
    }
  }

  // Fallback de SKU (busca no texto limpo de tags para evitar falsos positivos como id=grupo-sku-cor)
  if (!result.supplier_sku) {
    const cleanTextSample = result.raw_text_sample;
    const skuRegexes = [
      /(?:sku|código|ref)\s*[:\-]\s*([a-zA-Z0-9\-_]+)/i,
      /(?:código|ref)\s*([a-zA-Z0-9\-_]+)/i
    ];
    for (const reg of skuRegexes) {
      const match = cleanTextSample.match(reg);
      if (match && match[1] && match[1].toLowerCase() !== "cor" && match[1].toLowerCase() !== "tamanho") {
        result.supplier_sku = match[1];
        break;
      }
    }
    if (!result.supplier_sku) {
      result.supplier_sku = "FORN-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    }
  }

  // Fallback de Imagem
  if (!result.main_image_url) {
    const ogImgFallback = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImgFallback) {
      result.main_image_url = ogImgFallback[1];
    }
  }

  // Fallback de Preço / Custo
  if (!result.current_price) {
    // Procura padrões de preço em Real no texto limpo
    const priceRegex = /R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i;
    const priceMatch = html.match(priceRegex);
    if (priceMatch) {
      result.current_price = parsePrice(priceMatch[1]);
    }
  }

  // Preço antigo / De
  if (!result.original_price) {
    const oldPriceRegex = /(?:de|de\s*R\$)\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i;
    const oldPriceMatch = html.match(oldPriceRegex);
    if (oldPriceMatch) {
      result.original_price = parsePrice(oldPriceMatch[1]);
      if (result.original_price > result.current_price) {
        result.discount_percent = Math.round(
          ((result.original_price - result.current_price) / result.original_price) * 100
        );
      }
    } else {
      result.original_price = result.current_price;
    }
  }

  // D. EXTRAÇÃO DE GALERIA DE IMAGENS via DOMParser
  if (doc) {
    try {
      // Seletores comuns em e-commerce gráfico (Futura IM, Printi, RR Donnelley, etc.)
      const gallerySelectors = [
        ".carousel img", ".slick-slide img", ".owl-item img",
        ".gallery img", ".produto-fotos img", ".foto-produto img",
        ".product-gallery img", ".img-gallery img",
        ".thumbnails img", ".thumb-list img",
        "[data-gallery] img", "[data-fancybox] img",
        ".galeria-produto img", ".zoom-gallery img",
        ".product-image-gallery img",
        ".slides img"
      ];
      const uniqueImgUrls = new Set<string>(result.gallery_images);
      for (const sel of gallerySelectors) {
        const els = doc.querySelectorAll(sel);
        els.forEach(img => {
          const src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy") || img.getAttribute("data-original") || "";
          if (src && src.startsWith("http") && !uniqueImgUrls.has(src)) {
            // Filtra thumbnails muito pequenos (url com 'thumb' ou '50x50')
            if (!src.includes("-thumb") && !src.includes("_thumb") && !src.match(/[_-]\d{2,3}x\d{2,3}/)) {
              uniqueImgUrls.add(src);
              result.gallery_images.push(src);
            }
          }
        });
        if (result.gallery_images.length > 2) break;
      }

      // Também busca imagens em atributos data- (laço para carrosséis dinâmicos)
      if (result.gallery_images.length < 2) {
        const dataImgs = doc.querySelectorAll("[data-image], [data-img], [data-src], [data-zoom-image]");
        dataImgs.forEach(el => {
          const src = el.getAttribute("data-image") || el.getAttribute("data-img") || el.getAttribute("data-src") || el.getAttribute("data-zoom-image") || "";
          if (src && src.startsWith("http") && !uniqueImgUrls.has(src)) {
            uniqueImgUrls.add(src);
            result.gallery_images.push(src);
          }
        });
      }
    } catch (e) {
      console.error("Erro ao extrair galeria de imagens:", e);
    }

    // Garante que a imagem principal está na galeria
    if (result.main_image_url && !result.gallery_images.includes(result.main_image_url)) {
      result.gallery_images.unshift(result.main_image_url);
    }
  }

  // E. EXTRAÇÃO DE PRAZO DE PRODUÇÃO
  if (doc && result.production_deadline === "5 dias úteis") {
    // Busca via DOMParser em elementos específicos
    const prazoSelectors = [
      ".prazo", ".prazo-producao", ".prod-deadline",
      ".shipping-time", ".delivery-time", "[class*='prazo']"
    ];
    for (const sel of prazoSelectors) {
      const el = doc.querySelector(sel);
      if (el && el.textContent) {
        const text = cleanText(el.textContent);
        if (text && text.length < 80) {
          result.production_deadline = text;
          break;
        }
      }
    }
  }
  // Fallback regex para prazo
  if (result.production_deadline === "5 dias úteis") {
    const deadlineRegex = /(?:prazo|entrega|produção)[^\n]*?(\d+)\s*dias?\s*(?:úteis|corridos|útil)?/i;
    const deadlineMatch = html.match(deadlineRegex);
    if (deadlineMatch) {
      const days = parseInt(deadlineMatch[1]);
      if (days > 0 && days < 60) {
        result.production_deadline = `${days} dias úteis`;
      }
    }
  }

  // F. ESPECIFICAÇÕES TÉCNICAS (Chave-Valor)
  if (doc) {
    // Tenta capturar especificações selecionadas dinamicamente (como na Futura IM)
    const selectMaterial = doc.querySelector("#material-select option[selected], #material-select option:checked, select[id*='material'] option:checked");
    if (selectMaterial && selectMaterial.textContent) {
      result.specifications["Material"] = selectMaterial.textContent.trim();
    }
    
    const selectFormato = doc.querySelector("#formato-select option[selected], #formato-select option:checked, select[id*='formato'] option:checked");
    if (selectFormato && selectFormato.textContent) {
      result.specifications["Formato"] = selectFormato.textContent.trim();
    }
    
    const activeCor = doc.querySelector("#grupo-sku-cor button.active, .grupo-sku-cor button.active, button.active[class*='cor']");
    if (activeCor && activeCor.textContent) {
      result.specifications["Cor"] = activeCor.textContent.trim();
    }
    
    const activeEnobrecimento = doc.querySelector("#grupo-sku-enobrecimento button.active, .grupo-sku-enobrecimento button.active, button.active[class*='enobrecimento']");
    if (activeEnobrecimento && activeEnobrecimento.textContent) {
      result.specifications["Enobrecimento"] = activeEnobrecimento.textContent.trim();
    }
    
    const activeAcabamento = doc.querySelector("#grupo-sku-acabamento button.active, .grupo-sku-acabamento button.active, button.active[class*='acabamento']");
    if (activeAcabamento && activeAcabamento.textContent) {
      result.specifications["Acabamento"] = activeAcabamento.textContent.trim();
    }
  }

  if (Object.keys(result.specifications).length === 0) {
    // Procura por tabelas de especificações comuns
    const rows = html.matchAll(/<tr>\s*<t[dh][^>]*>([\s\S]*?)<\/t[dh]>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi);
    let rowCount = 0;
    for (const row of rows) {
      const key = cleanText(row[1]).replace(/:/g, "").trim();
      const val = cleanText(row[2]).trim();
      
      if (key && val && key.length < 30 && val.length < 150) {
        result.specifications[key] = val;
        rowCount++;
      }
      if (rowCount > 15) break;
    }

    // Se ainda vazio, procura listas <ul> com labels
    if (Object.keys(result.specifications).length === 0) {
      const listItems = html.matchAll(/<li>\s*<strong[^>]*>([\s\S]*?)<\/strong>([\s\S]*?)<\/li>/gi);
      for (const item of listItems) {
        const key = cleanText(item[1]).replace(/:/g, "").trim();
        const val = cleanText(item[2]).trim();
        if (key && val && key.length < 30 && val.length < 150) {
          result.specifications[key] = val;
        }
      }
    }
  }

  // G. TABELA DE PREÇOS POR QUANTIDADE (Tiragens)
  if (result.quantity_prices.length === 0) {
    // Se o DOMParser estiver disponível, tenta extrair de tabelas de tiragens conhecidas (como a da Futura IM)
    if (doc) {
      const tableRows = doc.querySelectorAll("#table-variacoes tbody tr, .table-variacoes tbody tr, table.table-hover tbody tr");
      if (tableRows && tableRows.length > 0) {
        const uniqueQties = new Set<number>();
        tableRows.forEach(row => {
          const cells = row.querySelectorAll("td");
          if (cells.length >= 2) {
            const qtyText = cells[0].textContent || "";
            const qtyMatch = qtyText.match(/(\d+)\s*(?:unidades|unid|un|x|mil|unidades)?/i);
            const qty = qtyMatch ? parseInt(qtyMatch[1]) : 0;
            
            // O preço total costuma ser na última célula
            const lastCell = cells[cells.length - 1];
            const priceText = lastCell ? lastCell.textContent || "" : "";
            const price = parsePrice(priceText);
            
            if (qty > 0 && price > 0 && !uniqueQties.has(qty)) {
              uniqueQties.add(qty);
              result.quantity_prices.push({
                quantity: qty,
                price: price,
                unitPrice: parseFloat((price / qty).toFixed(4))
              });
            }
          }
        });
      }
    }

    // Se não encontrou tabelas, faz o fallback tradicional por Regex
    if (result.quantity_prices.length === 0) {
      const qtyRegex = /(?:tiragem|quantidade|qtd|unidades|unid|un)\s*[:\-]?\s*(\d+)\s*(?:unidades|unid|un|x)?[\s\S]*?(?:por|R\$)\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/gi;
      const qtyMatches = html.matchAll(qtyRegex);
      const uniqueQties = new Set<number>();
      
      for (const qm of qtyMatches) {
        const qty = parseInt(qm[1]);
        const price = parsePrice(qm[2]);
        if (qty > 0 && price > 0 && !uniqueQties.has(qty)) {
          uniqueQties.add(qty);
          result.quantity_prices.push({
            quantity: qty,
            price: price,
            unitPrice: parseFloat((price / qty).toFixed(4))
          });
        }
      }
    }
    // Ordena por quantidade crescente
    result.quantity_prices.sort((a, b) => a.quantity - b.quantity);

    // Se nenhuma tabela de quantidade foi capturada por Regex, gera uma simulação baseada no preço unitário padrão
    if (result.quantity_prices.length === 0 && result.current_price > 0) {
      const basePrice = result.current_price;
      const defaultTiragens = [100, 250, 500, 1000, 2500];
      result.quantity_prices = defaultTiragens.map(qty => {
        // Aplica um desconto de escala de tiragem realista (de 0% a 35% de desconto unitário)
        const discountFactor = qty === 100 ? 1 : qty === 250 ? 0.92 : qty === 500 ? 0.85 : qty === 1000 ? 0.78 : 0.70;
        const unitPrice = parseFloat((basePrice * discountFactor).toFixed(4));
        const totalPrice = parseFloat((unitPrice * qty).toFixed(2));
        return {
          quantity: qty,
          price: totalPrice,
          unitPrice: unitPrice
        };
      });
    }
  }

  // H. VARIAÇÕES DE PRODUTO
  if (doc) {
    try {
      // 1. Mapear variações via <select> (como Material e Formato)
      const selects = doc.querySelectorAll("select");
      selects.forEach(select => {
        let labelText = "";
        
        if (select.id) {
          const labelEl = doc.querySelector(`label[for="${select.id}"]`);
          if (labelEl) {
            labelText = labelEl.textContent || "";
          }
        }
        
        if (!labelText) {
          const dataType = select.getAttribute("data-type") || select.getAttribute("name") || "";
          labelText = dataType;
        }
        
        labelText = cleanText(labelText).replace(/:/g, "").trim();
        if (!labelText) return;
        
        const values: string[] = [];
        const options = select.querySelectorAll("option");
        options.forEach(opt => {
          const val = cleanText(opt.textContent || "").trim();
          if (val && !val.includes("Selecione") && !val.includes("Escolha") && val.length < 60) {
            values.push(val);
          }
        });
        
        if (values.length > 0) {
          const existingIdx = result.variations.findIndex(v => v.name.toLowerCase() === labelText.toLowerCase());
          if (existingIdx >= 0) {
            result.variations[existingIdx].values = Array.from(new Set([...result.variations[existingIdx].values, ...values]));
          } else {
            result.variations.push({ name: labelText, values });
          }
        }
      });

      // 2. Mapear variações via grupos de botões (.btn-group, [id*='grupo-sku'], [class*='grupo-sku'])
      const buttonGroups = doc.querySelectorAll(".btn-group, [id*='grupo-sku'], [class*='grupo-sku']");
      buttonGroups.forEach(group => {
        let labelText = group.getAttribute("aria-label") || "";
        
        if (!labelText) {
          const prevEl = group.previousElementSibling;
          if (prevEl && (prevEl.tagName === "SPAN" || prevEl.tagName === "LABEL")) {
            labelText = prevEl.textContent || "";
          }
        }
        
        labelText = cleanText(labelText).replace(/:/g, "").trim();
        if (!labelText || labelText.toLowerCase() === "compartilhar" || labelText.toLowerCase() === "redes sociais") return;
        
        const values: string[] = [];
        const buttons = group.querySelectorAll("button, a.btn, .btn");
        buttons.forEach(btn => {
          const val = cleanText(btn.textContent || "").trim();
          if (val && val.length < 60 && !val.includes("Ajuda") && !val.includes("?") && !val.toLowerCase().includes("gabarito")) {
            values.push(val);
          }
        });
        
        if (values.length > 0) {
          const existingIdx = result.variations.findIndex(v => v.name.toLowerCase() === labelText.toLowerCase());
          if (existingIdx >= 0) {
            result.variations[existingIdx].values = Array.from(new Set([...result.variations[existingIdx].values, ...values]));
          } else {
            result.variations.push({ name: labelText, values });
          }
        }
      });

      // 3. Mapear acabamentos extras / adicionais opcionais (.acabamento-box, .acab-adicional)
      const acabAdicionais = doc.querySelectorAll(".acabamento-box, label[class*='acabamento'], .acab-adicional");
      if (acabAdicionais && acabAdicionais.length > 0) {
        const uniqueServices = new Set<string>();
        acabAdicionais.forEach(box => {
          const labelSpan = box.querySelector(".acabamento-label, span");
          if (labelSpan) {
            let text = labelSpan.textContent || "";
            
            const priceEl = labelSpan.querySelector(".preco, span[class*='preco']");
            const priceText = priceEl ? priceEl.textContent || "" : "";
            const price = priceText ? parsePrice(priceText) : 0;
            
            let name = text;
            if (priceText) {
              name = name.replace(priceText, "");
            }
            const prazoEl = labelSpan.querySelector(".prazo, span[class*='prazo']");
            if (prazoEl) {
              name = name.replace(prazoEl.textContent || "", "");
            }
            
            name = cleanText(name).replace(/\+?\s*R\$\s*[0-9.,]+/gi, "").trim();
            name = name.replace(/\(\s*\+\s*\d+\s*dia[s]?\s*\)/gi, "").trim();
            
            if (name && price > 0 && !uniqueServices.has(name)) {
              uniqueServices.add(name);
              result.extra_services.push({ name, price });
            }
          }
        });
      }
    } catch (e) {
      console.error("Erro ao extrair variações por DOMParser:", e);
    }
  }

  // Fallback tradicional caso variações estejam vazias
  if (result.variations.length === 0) {
    const selectMatches = html.matchAll(/<select[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi);
    for (const sel of selectMatches) {
      const name = cleanText(sel[1]).replace(/select|filter|option|prod/gi, "").trim();
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      
      const optionMatches = sel[2].matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi);
      const values: string[] = [];
      for (const opt of optionMatches) {
        const val = cleanText(opt[1]);
        if (val && !val.includes("Selecione") && !val.includes("Escolha") && val.length < 50) {
          values.push(val);
        }
      }
      if (values.length > 0 && label.length > 2) {
        result.variations.push({ name: label, values });
      }
    }
  }

  // I. LINKS DE GABARITOS
  const templateMatches = html.matchAll(/<a\s+[^>]*href=["']([^"']+\.(?:pdf|cdr|ai|psd|zip|rar))["'][^>]*>([\s\S]*?)<\/a>/gi);
  const uniqueTemplates = new Set<string>();
  for (const tm of templateMatches) {
    const url = tm[1];
    const name = cleanText(tm[2]) || "Gabarito";
    if (!uniqueTemplates.has(url)) {
      uniqueTemplates.add(url);
      result.template_links.push({ name, url });
    }
  }

  return result;
}

function applyExtractionRule(html: string, rule: any, doc?: Document | null): string | null {
  try {
    const { extraction_method, selector, regex_pattern, label_anchor, attribute_name } = rule;

    switch (extraction_method) {
      case "meta_tag":
        if (!selector) return null;
        if (doc) {
          const meta = doc.querySelector(`meta[name="${selector}"], meta[property="${selector}"]`);
          if (meta) {
            const content = meta.getAttribute("content");
            if (content) return decodeHtmlEntities(content);
          }
        }
        const metaRegex = new RegExp(`<meta\\s+[^>]*(?:name|property)=["']${escapeRegex(selector)}["']\\s+content=["']([^"']+)["']`, "i");
        const metaMatch = html.match(metaRegex);
        return metaMatch ? decodeHtmlEntities(metaMatch[1]) : null;

      case "regex":
        if (!regex_pattern) return null;
        const reg = new RegExp(regex_pattern, "i");
        const match = html.match(reg);
        if (match) {
          return match[1] || match[0];
        }
        return null;

      case "text_after_label":
        if (!label_anchor) return null;
        const labelRegex = new RegExp(`${escapeRegex(label_anchor)}\\s*[:\\-]?\\s*([^<\\n\\r]+)`, "i");
        const labelMatch = html.match(labelRegex);
        return labelMatch ? cleanText(labelMatch[1]) : null;

      case "css_attribute":
        if (!selector || !attribute_name) return null;
        if (doc) {
          const el = doc.querySelector(selector);
          if (el) {
            return el.getAttribute(attribute_name);
          }
        }
        // Fallback para regex
        const tagRegex = new RegExp(`<[^>]*class=["'][^"']*${escapeRegex(selector)}[^"']*["'][^>]*${escapeRegex(attribute_name)}=["']([^"']+)["']`, "i");
        const tagMatch = html.match(tagRegex);
        return tagMatch ? tagMatch[1] : null;

      case "css_selector":
        if (!selector) return null;
        if (doc) {
          const el = doc.querySelector(selector);
          if (el) {
            return el.textContent;
          }
        }
        // Fallback para regex
        const classRegex = new RegExp(`<[^>]+class=["'][^"']*${escapeRegex(selector)}[^"']*["'][^>]*>([\\s\\S]*?)<\\/`, "i");
        const classMatch = html.match(classRegex);
        return classMatch ? cleanText(classMatch[1]) : null;

      default:
        return null;
    }
  } catch (e) {
    console.error("Erro ao aplicar regra de mapeamento:", e);
    return null;
  }
}

function mapFieldToResult(result: ExtractedProductData, fieldKey: string, value: string, rule: any) {
  switch (fieldKey) {
    case "product_name":
      result.product_name = value;
      break;
    case "supplier_sku":
      result.supplier_sku = value;
      break;
    case "category":
      result.category = value;
      break;
    case "subcategory":
      result.subcategory = value;
      break;
    case "main_image_url":
      result.main_image_url = value;
      break;
    case "current_price":
      result.current_price = parsePrice(value);
      break;
    case "original_price":
      result.original_price = parsePrice(value);
      break;
    case "production_deadline":
      result.production_deadline = value;
      break;
    case "specifications":
      try {
        if (rule.label_anchor) {
          result.specifications[rule.label_anchor] = value;
        } else {
          result.specifications["Mapeado"] = value;
        }
      } catch {}
      break;
  }
}

// Helpers
function escapeRegex(str: string): string {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

function cleanText(str: string): string {
  if (!str) return "";
  return str
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  
  // No navegador, a forma mais robusta e completa de decodificar entidades HTML
  if (typeof document !== "undefined") {
    try {
      const txt = document.createElement("textarea");
      txt.innerHTML = str;
      return txt.value;
    } catch (e) {}
  }
  
  // Fallback / Servidor: decodifica entidades básicas e hexadecimais comuns
  let decoded = str;
  // Resolve entidades hexadecimais (ex: &#xE3; ou &#xe3;)
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  // Resolve entidades decimais (ex: &#227;)
  decoded = decoded.replace(/&#([0-9]+);/g, (match, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });
  // Entidades nomeadas comuns
  const entities: Record<string, string> = {
    "amp": "&",
    "lt": "<",
    "gt": ">",
    "quot": '"',
    "apos": "'",
    "nbsp": " ",
    "atilde": "ã",
    "Atilde": "Ã",
    "eacute": "é",
    "Eacute": "É",
    "ccedil": "ç",
    "Cccedil": "Ç",
    "otilde": "õ",
    "Otilde": "Õ",
    "iacute": "í",
    "Iacute": "Í",
    "aacute": "á",
    "Aacute": "Á",
    "oacute": "ó",
    "Oacute": "Ó",
    "uacute": "ú",
    "Uacute": "Ú",
    "acirc": "â",
    "Acirc": "Â",
    "ecirc": "ê",
    "Ecirc": "Ê",
    "ocirc": "ô",
    "Ocirc": "Ô"
  };
  decoded = decoded.replace(/&([a-zA-Z]+);/g, (match, name) => {
    return entities[name] || match;
  });
  
  return decoded;
}
