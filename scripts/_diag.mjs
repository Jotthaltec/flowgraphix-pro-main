// scripts/diag-parser.ts
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// src/services/productNormalizer.ts
function deburr(str) {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function normalizeKey(str) {
  return deburr(str || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function slugify(str) {
  return deburr(str || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function cleanText(str) {
  return (str || "").replace(/\s+/g, " ").trim();
}
function parsePriceBR(input) {
  if (input == null) return 0;
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  let s = String(input).replace(/R\$/gi, "").replace(/\s/g, "");
  if (!s) return 0;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const val = parseFloat(s);
  return Number.isFinite(val) ? val : 0;
}
function discountPercent(oldPrice, current) {
  if (!oldPrice || oldPrice <= 0 || current >= oldPrice) return 0;
  return Math.round((oldPrice - current) / oldPrice * 100);
}
var SIZE_LABELS = /* @__PURE__ */ new Set(["p", "m", "g", "gg", "gg1", "gg2", "xg", "xgg", "pp", "xs", "s", "l", "xl", "xxl"]);
function toMm(value, unit) {
  switch (unit) {
    case "mm":
      return value;
    case "cm":
      return value * 10;
    case "m":
      return value * 1e3;
    default:
      return value;
  }
}
function parseDimensions(input) {
  const original = cleanText(input);
  const lower = deburr(original).toLowerCase();
  if (SIZE_LABELS.has(lower.replace(/\s/g, ""))) {
    return { original, unit: "size_label", is_special: true };
  }
  const ml = lower.match(/([\d.,]+)\s*(ml|l|litros?)/);
  if (ml && !lower.match(/\d\s*x\s*\d/)) {
    return { original, unit: "ml", is_special: true, note: "capacidade" };
  }
  if (/personalizad|sob\s*medida|tamanho\s*livre|custom/.test(lower)) {
    return { original, unit: "custom", is_special: true };
  }
  const m = lower.match(
    /([\d]+(?:[.,]\d+)?)\s*x\s*([\d]+(?:[.,]\d+)?)(?:\s*x\s*([\d]+(?:[.,]\d+)?))?\s*(mm|cm|m)?/
  );
  if (m) {
    const unit = m[4] || "mm";
    const w = parseFloat(m[1].replace(",", "."));
    const h = parseFloat(m[2].replace(",", "."));
    const d = m[3] ? parseFloat(m[3].replace(",", ".")) : void 0;
    return {
      original,
      width: w,
      height: h,
      depth: d,
      unit,
      width_mm: Math.round(toMm(w, unit)),
      height_mm: Math.round(toMm(h, unit)),
      depth_mm: d != null ? Math.round(toMm(d, unit)) : void 0
    };
  }
  return { original };
}
function parseColorCode(input) {
  const original = cleanText(input);
  const m = original.match(/(\d)\s*[x×]\s*(\d)/);
  if (!m) {
    return { original_color_code: original };
  }
  const front = parseInt(m[1], 10);
  const back = parseInt(m[2], 10);
  const hasWhite = front === 5 || back === 5;
  const parts = [];
  if (front === 0) parts.push("sem impress\xE3o na frente");
  else if (front === 1) parts.push("1 cor na frente");
  else if (front === 4) parts.push("colorido na frente");
  else if (front === 5) parts.push("colorido com branco na frente");
  else parts.push(`${front} cores na frente`);
  if (back === 0) parts.push("sem impress\xE3o no verso");
  else if (back === 1) parts.push("1 cor no verso");
  else if (back === 4) parts.push("colorido no verso");
  else if (back === 5) parts.push("colorido com branco no verso");
  else parts.push(`${back} cores no verso`);
  return {
    original_color_code: original.match(/\d\s*[x×]\s*\d/)?.[0] || original,
    front_colors: front,
    back_colors: back,
    front_printed: front > 0,
    back_printed: back > 0,
    has_white_ink: hasWhite,
    description: parts.join(", ")
  };
}
var MATERIAL_FAMILIES = [
  "couch\xE9",
  "couche",
  "offset",
  "supremo",
  "triplex",
  "duplex",
  "kraft",
  "polionda",
  "adesivo",
  "vinil",
  "lona",
  "papel",
  "cart\xE3o",
  "cartao",
  "sulfite",
  "reciclato",
  "tecido",
  "ps",
  "pvc",
  "acr\xEDlico",
  "acrilico"
];
var SURFACES = ["brilho", "fosco", "fosca", "matte", "acetinado"];
function parseMaterial(input) {
  const original_material = cleanText(input);
  const lower = deburr(original_material).toLowerCase();
  const result = { original_material };
  const family = MATERIAL_FAMILIES.find((f) => lower.includes(deburr(f)));
  if (family) {
    result.material_family = family.charAt(0).toUpperCase() + family.slice(1);
  }
  const surface = SURFACES.find((s) => lower.includes(s));
  if (surface) result.surface = surface.charAt(0).toUpperCase() + surface.slice(1);
  const gram = lower.match(/(\d{2,4})\s*g(?:\/?m2|sm)?\b/);
  if (gram) result.grammage_gsm = parseInt(gram[1], 10);
  const thick = lower.match(/(\d+(?:[.,]\d+)?)\s*mm\b/);
  if (thick) result.thickness_mm = parseFloat(thick[1].replace(",", "."));
  const color = lower.match(/\b(branca|branco|preta|preto|transparente|cristal)\b/);
  if (color) result.color = color[1];
  const comp = lower.match(/\b(poli[eé]ster|algod[aã]o|pet|pp|pvc)\b/);
  if (comp) result.composition = comp[1];
  return result;
}
function parseProductionTime(input) {
  const original_production_time = cleanText(input);
  const lower = deburr(original_production_time).toLowerCase();
  const result = { original_production_time };
  const days = lower.match(/(\d+)\s*dias?\b/);
  if (days) result.production_days = parseInt(days[1], 10);
  if (/uteis|util/.test(lower)) result.production_day_type = "business_days";
  else if (/corridos?/.test(lower)) result.production_day_type = "calendar_days";
  if (/\+\s*frete|mais\s*frete|frete\b/.test(lower)) result.freight_not_included = true;
  return result;
}
function parseQuantity(input) {
  const s = deburr(String(input)).toLowerCase().replace(/\s/g, "");
  const m = s.match(/([\d.]+)/);
  if (!m) return 0;
  const n = parseInt(m[1].replace(/\./g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

// src/services/productClassifier.ts
var CATEGORY_TREE = [
  {
    category: "Adesivos e R\xF3tulos",
    subcategories: [
      { name: "DTF UV", keywords: ["dtf uv", "dtfuv", "dtf - uv"] },
      { name: "Adesivo em Vinil", keywords: ["adesivo em vinil", "adesivo vinil", "vinil adesivo"] },
      { name: "Adesivo Perfurado", keywords: ["adesivo perfurado", "perfurado"] },
      { name: "Adesivo Hologr\xE1fico", keywords: ["adesivo holografico", "holografico"] },
      { name: "Adesivo Eletrost\xE1tico", keywords: ["eletrostatico"] },
      { name: "Adesivo de Recorte", keywords: ["adesivo de recorte", "recorte eletronico"] },
      { name: "Adesivo Resinado", keywords: ["resinado", "resina"] },
      { name: "R\xF3tulo em Bobina", keywords: ["rotulo em bobina", "bobina"] },
      { name: "R\xF3tulo", keywords: ["rotulo"] },
      { name: "Etiqueta", keywords: ["etiqueta"] },
      { name: "Sticker", keywords: ["sticker"] },
      { name: "Adesivo", keywords: ["adesivo"] }
    ]
  },
  {
    category: "Vestu\xE1rio e T\xEAxtil",
    subcategories: [
      { name: "DTF T\xEAxtil", keywords: ["dtf textil", "dtf t\xEAxtil", "dtf para tecido", "transfer dtf"] },
      { name: "Camiseta", keywords: ["camiseta", "dry fit", "baby look"] },
      { name: "Camisa", keywords: ["camisa", "polo"] },
      { name: "Moletom", keywords: ["moletom", "blusa de frio"] },
      { name: "Bon\xE9", keywords: ["bone", "bon\xE9"] },
      { name: "Avental", keywords: ["avental"] },
      { name: "Uniforme", keywords: ["uniforme"] },
      { name: "Abad\xE1", keywords: ["abada"] },
      { name: "Tecido Impresso", keywords: ["tecido impresso", "tecido personalizado"] }
    ]
  },
  {
    category: "Comunica\xE7\xE3o Visual",
    subcategories: [
      { name: "Wind Banner", keywords: ["wind banner", "windbanner", "fly banner"] },
      { name: "Banner", keywords: ["banner", "faixa lona"] },
      { name: "Faixa", keywords: ["faixa"] },
      { name: "Backdrop", keywords: ["backdrop", "painel de fundo"] },
      { name: "Painel", keywords: ["painel"] },
      { name: "Adesivo para Vitrine", keywords: ["vitrine"] },
      { name: "Papel de Parede", keywords: ["papel de parede"] },
      { name: "Sinaliza\xE7\xE3o", keywords: ["sinalizacao"] },
      { name: "Display", keywords: ["display"] }
    ]
  },
  {
    category: "Embalagens e Sacolas",
    subcategories: [
      { name: "Sacola de Papel", keywords: ["sacola de papel", "sacola kraft"] },
      { name: "Sacola Pl\xE1stica", keywords: ["sacola plastica", "sacola pl\xE1stica"] },
      { name: "Ecobag", keywords: ["ecobag", "eco bag", "sacola retornavel"] },
      { name: "Caixa", keywords: ["caixa", "embalagem delivery", "box"] },
      { name: "Cinta", keywords: ["cinta"] },
      { name: "Solapa", keywords: ["solapa"] },
      { name: "Fita", keywords: ["fita personalizada", "fita de cetim"] },
      { name: "Envelope de Embalagem", keywords: ["envelope de embalagem", "envelope plastico"] }
    ]
  },
  {
    category: "Editorial",
    subcategories: [
      { name: "Revista", keywords: ["revista"] },
      { name: "Livro", keywords: ["livro"] },
      { name: "Apostila", keywords: ["apostila"] },
      { name: "Manual", keywords: ["manual"] },
      { name: "Cat\xE1logo", keywords: ["catalogo"] }
    ]
  },
  {
    category: "Papelaria Corporativa",
    subcategories: [
      { name: "Papel Timbrado", keywords: ["papel timbrado", "timbrado"] },
      { name: "Envelope", keywords: ["envelope"] },
      { name: "Pasta", keywords: ["pasta"] },
      { name: "Bloco Autocopiativo", keywords: ["autocopiativo", "bloco autocopiativo"] },
      { name: "Tal\xE3o", keywords: ["talao", "tal\xE3o", "nota fiscal", "recibo"] },
      { name: "Bloco", keywords: ["bloco", "bloco de anotacoes"] },
      { name: "Receitu\xE1rio", keywords: ["receituario", "receitu\xE1rio"] },
      { name: "Agenda", keywords: ["agenda"] },
      { name: "Caderno", keywords: ["caderno", "caderneta"] },
      { name: "Marcador de P\xE1gina", keywords: ["marcador de pagina", "marca pagina"] },
      { name: "Carimbo", keywords: ["carimbo"] },
      { name: "Credencial", keywords: ["credencial", "cracha", "crach\xE1"] }
    ]
  },
  {
    category: "Impressos Promocionais",
    subcategories: [
      { name: "Mini Cart\xE3o", keywords: ["mini cartao", "minicard"] },
      { name: "Cart\xE3o Fidelidade", keywords: ["cartao fidelidade", "fidelidade"] },
      { name: "Cart\xE3o de Visita", keywords: ["cartao de visita", "cart\xE3o de visita"] },
      { name: "Folder", keywords: ["folder"] },
      { name: "Panfleto", keywords: ["panfleto"] },
      { name: "Folheto", keywords: ["folheto"] },
      { name: "Postal", keywords: ["postal", "cartao postal"] },
      { name: "Cartaz e P\xF4ster", keywords: ["cartaz", "poster", "p\xF4ster"] },
      { name: "Convite", keywords: ["convite"] },
      { name: "Certificado", keywords: ["certificado", "diploma"] },
      { name: "Card\xE1pio", keywords: ["cardapio", "card\xE1pio"] }
    ]
  },
  {
    category: "Brindes e Personalizados",
    subcategories: [
      { name: "Caneca", keywords: ["caneca"] },
      { name: "Copo", keywords: ["copo", "long drink"] },
      { name: "Garrafa", keywords: ["garrafa", "squeeze"] },
      { name: "Caneta", keywords: ["caneta"] },
      { name: "Chaveiro", keywords: ["chaveiro"] },
      { name: "Botton", keywords: ["botton", "button"] },
      { name: "Im\xE3", keywords: ["ima", "im\xE3", "ima de geladeira"] },
      { name: "Mouse Pad", keywords: ["mouse pad", "mousepad"] },
      { name: "Capinha", keywords: ["capinha", "case celular"] },
      { name: "Azulejo", keywords: ["azulejo"] },
      { name: "R\xE9gua", keywords: ["regua", "r\xE9gua"] }
    ]
  },
  {
    category: "Placas e Sinaliza\xE7\xE3o",
    subcategories: [
      { name: "Placa em PVC", keywords: ["placa em pvc", "placa pvc"] },
      { name: "Placa em PS", keywords: ["placa em ps", "placa ps"] },
      { name: "Placa em Acr\xEDlico", keywords: ["placa em acrilico", "placa acrilico"] },
      { name: "Placa em Polionda", keywords: ["placa em polionda", "polionda"] },
      { name: "Placa Imobili\xE1ria", keywords: ["placa imobiliaria"] },
      { name: "Placa", keywords: ["placa"] }
    ]
  },
  {
    category: "Ponto de Venda",
    subcategories: [
      { name: "Wobbler", keywords: ["wobbler"] },
      { name: "M\xF3bile", keywords: ["mobile", "m\xF3bile"] },
      { name: "Faixa de G\xF4ndola", keywords: ["gondola", "g\xF4ndola"] },
      { name: "Plaquinha de Pre\xE7o", keywords: ["plaquinha de preco", "preco de gondola"] },
      { name: "Porta-copos", keywords: ["porta-copos", "porta copos", "bolacha de chopp"] }
    ]
  }
];
var SEGMENT_KEYWORDS = [
  { segment: "Restaurante/Pizzaria", keywords: ["pizzaria", "restaurante", "lanchonete", "delivery", "hamburgueria"] },
  { segment: "Cl\xEDnica/Sa\xFAde", keywords: ["clinica", "cl\xEDnica", "consultorio", "dentista", "medico"] },
  { segment: "Escola/Educa\xE7\xE3o", keywords: ["escola", "faculdade", "educacao"] },
  { segment: "Academia/Fitness", keywords: ["academia", "fitness", "crossfit"] },
  { segment: "Pet Shop", keywords: ["pet shop", "petshop", "pet"] },
  { segment: "Loja de Roupa/Moda", keywords: ["loja de roupa", "moda", "boutique"] },
  { segment: "Casamento", keywords: ["casamento", "noivos"] },
  { segment: "Festa/Evento", keywords: ["festa", "aniversario", "evento"] },
  { segment: "Empresarial", keywords: ["empresa", "corporativo"] }
];
var TECHNIQUE_KEYWORDS = [
  { sector: "DTF UV", keywords: ["dtf uv"] },
  { sector: "DTF T\xEAxtil", keywords: ["dtf textil", "dtf t\xEAxtil", "dtf para tecido"] },
  { sector: "Sublima\xE7\xE3o", keywords: ["sublimacao", "sublim\xE1tico", "caneca", "azulejo"] },
  { sector: "Eco-solvente", keywords: ["eco-solvente", "eco solvente", "lona", "banner"] },
  { sector: "Serigrafia", keywords: ["serigrafia", "silk"] },
  { sector: "Laser", keywords: ["gravacao laser", "corte a laser"] },
  { sector: "UV Direto", keywords: ["uv direto", "impressao uv"] },
  { sector: "Corte Eletr\xF4nico", keywords: ["corte eletronico", "recorte"] },
  { sector: "Offset", keywords: ["offset", "couche", "couch\xE9"] },
  { sector: "Impress\xE3o Digital", keywords: ["impressao digital", "digital"] }
];
function has(haystack, term) {
  return haystack.includes(deburr(term).toLowerCase());
}
function classifyProduct(input) {
  const name = deburr(input.name || "").toLowerCase();
  const breadcrumb = (input.breadcrumb || []).map((b) => deburr(b).toLowerCase());
  const specs = (input.specifications || []).map((s) => deburr(s).toLowerCase()).join(" ");
  const material = deburr(input.material || "").toLowerCase();
  const description = deburr(input.description || "").toLowerCase();
  const matches = [];
  for (const cat of CATEGORY_TREE) {
    for (const sub of cat.subcategories) {
      for (const kw of sub.keywords) {
        let confidence = 0;
        let source = "";
        if (has(name, kw)) {
          confidence = 95;
          source = "nome do produto";
        } else if (breadcrumb.some((b) => has(b, kw))) {
          confidence = 88;
          source = "breadcrumb";
        } else if (has(specs, kw)) {
          confidence = 78;
          source = "especifica\xE7\xF5es";
        } else if (has(material, kw)) {
          confidence = 70;
          source = "material";
        } else if (has(description, kw)) {
          confidence = 60;
          source = "descri\xE7\xE3o";
        }
        if (confidence > 0) {
          matches.push({ category: cat.category, subcategory: sub.name, confidence, source });
        }
      }
    }
  }
  const best = matches.length ? matches.reduce((a, b) => b.confidence > a.confidence ? b : a) : null;
  const fullText = `${name} ${breadcrumb.join(" ")} ${specs} ${description}`;
  const segments = SEGMENT_KEYWORDS.filter((s) => s.keywords.some((k) => has(fullText, k))).map(
    (s) => s.segment
  );
  let production_sector = "N\xE3o identificado";
  for (const t of TECHNIQUE_KEYWORDS) {
    if (t.keywords.some((k) => has(fullText, k) || has(material, k))) {
      production_sector = t.sector;
      break;
    }
  }
  if (!best) {
    return {
      category: "N\xE3o classificado",
      subcategory: "Geral",
      confidence: 0,
      reason: "Nenhuma palavra-chave de categoria foi reconhecida no produto.",
      tags: [],
      segments,
      production_sector,
      review_required: true
    };
  }
  const tags = Array.from(
    /* @__PURE__ */ new Set([best.subcategory, ...segments, production_sector !== "N\xE3o identificado" ? production_sector : ""])
  ).filter(Boolean);
  return {
    category: best.category,
    subcategory: best.subcategory,
    confidence: best.confidence,
    reason: `Classificado como "${best.subcategory}" (categoria ${best.category}) a partir de: ${best.source}.`,
    tags,
    segments,
    production_sector,
    review_required: best.confidence < 80
  };
}

// src/services/futuraImParser.ts
var FUTURAIM_SUPPLIER = "FuturaIM";
function decodeEntities(s) {
  if (!s) return "";
  return s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10))).replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&nbsp;/gi, " ");
}
function stripTags(s) {
  return cleanText(decodeEntities((s || "").replace(/<[^>]+>/g, " ")));
}
function extractJsonLd(html) {
  const out = [];
  const re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while (m = re.exec(html)) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
    }
  }
  return out;
}
function ldType(obj) {
  const t = obj?.["@type"];
  if (!t) return [];
  return Array.isArray(t) ? t.map(String) : [String(t)];
}
function extractDataLayerItem(html) {
  const m = html.match(/dataLayer\.push\((\{[^]*?"event"\s*:\s*"view_item"[^]*?\})\);/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}
function externalIdFromUrl(url) {
  const m = url.match(/[?&]id=(\d+)/);
  return m ? m[1] : void 0;
}
function extractBreadcrumb(html) {
  const block = html.match(/<ol[^>]*class=["']?breadcrumb[^>]*>([\s\S]*?)<\/ol>/i);
  if (!block) return [];
  const names = [...block[1].matchAll(/itemprop=["']?name["']?>\s*([^<]+?)\s*<\/span>/gi)].map(
    (m) => stripTags(m[1])
  );
  return names.filter((n) => n && !/^in[ií]cio$|^home$/i.test(n));
}
function extractPriceTiers(html, collectedAt, currentId) {
  const tiers = [];
  const seen = /* @__PURE__ */ new Set();
  const rows = html.split(/<tr\b/i).slice(1);
  for (const raw of rows) {
    const endIdx = raw.search(/<\/tr>|<\/tbody>|<\/table>/i);
    const chunk = endIdx >= 0 ? raw.slice(0, endIdx) : raw;
    if (!/qtd-sku/i.test(chunk)) continue;
    let qty = 0;
    const qm = chunk.match(/name=["']?qtd-sku["']?[^>]*>\s*([\d.\s]+?)\s*unidad/i);
    if (qm) qty = parseQuantity(qm[1]);
    if (!qty) {
      const idm = chunk.match(/input\s+id=["']?(\d+)["']?[^>]*qtd-sku|qtd-sku[^>]*id=["']?(\d+)/i);
      if (idm) qty = parseInt(idm[1] || idm[2], 10);
    }
    if (!qty || seen.has(qty)) continue;
    const unitM = chunk.match(/R\$\s*([\d.,]+)\s*\/\s*un/i);
    const unit_price = unitM ? parsePriceBR(unitM[1]) : 0;
    const withoutUnit = chunk.replace(/R\$\s*[\d.,]+\s*\/\s*un/gi, " ");
    const totals = [...withoutUnit.matchAll(/R\$\s*([\d.,]+)/gi)].map((m) => parsePriceBR(m[1]));
    const total_price = totals.length ? totals[totals.length - 1] : 0;
    if (!total_price) continue;
    const idM = chunk.match(/trocarProduto\([^,]+,\s*(\d+)\s*\)/i);
    seen.add(qty);
    tiers.push({
      quantity: qty,
      unit: "unidade",
      total_price,
      unit_price: unit_price || parseFloat((total_price / qty).toFixed(4)),
      currency: "BRL",
      available: true,
      external_id: idM ? idM[1] : void 0,
      collected_at: collectedAt
    });
  }
  tiers.sort((a, b) => a.quantity - b.quantity);
  return tiers;
}
function extractVariantAxes(html) {
  const axes = /* @__PURE__ */ new Map();
  function ensure(name) {
    const key = normalizeKey(name);
    if (!axes.has(key)) {
      axes.set(key, { name, normalized_name: key, options: [] });
    }
    return axes.get(key);
  }
  function addOption(axisName, value, url, selected) {
    const v = stripTags(value);
    if (!v) return;
    const axis = ensure(axisName);
    const external_id = url ? externalIdFromUrl(url) : void 0;
    const nv = normalizeKey(v);
    const existing = axis.options.find((o) => o.normalized_value === nv);
    if (existing) {
      if (!existing.external_id && external_id) {
        existing.external_id = external_id;
        existing.url = url;
      }
      if (selected) existing.selected = true;
      return;
    }
    axis.options.push({ value: v, normalized_value: nv, external_id, url, selected });
  }
  const selRe = /<select[^>]*data-type=["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/select>/gi;
  let sm;
  while (sm = selRe.exec(html)) {
    const axisName = stripTags(sm[1]);
    const optRe = /<option\b([^>]*)>\s*([^<]*?)\s*(?=<|$)/gi;
    let om;
    while (om = optRe.exec(sm[2])) {
      const attrs = om[1];
      const text = om[2];
      if (!text) continue;
      const urlM = attrs.match(/value=["']([^"']*\?id=\d+[^"']*)["']/i);
      const selected = /\bselected\b/i.test(attrs);
      addOption(axisName, text, urlM ? urlM[1] : void 0, selected);
    }
  }
  const tagRe = /<(?:a|button)\b([^>]*\btitle=["']Ver produto (?:no|na|com|em)\s+([A-Za-zÀ-ú]+)\s+([^"']+)["'][^>]*)>/gi;
  let tm;
  while (tm = tagRe.exec(html)) {
    const attrs = tm[1];
    const axisName = stripTags(tm[2]);
    const value = stripTags(tm[3]);
    const urlM = attrs.match(/(\/produto\/[^"'\s]*\?id=\d+)/i) || attrs.match(/[?&]id=\d+/i);
    const url = urlM ? urlM[0] : void 0;
    const selected = /\bactive\b|aria-current/i.test(attrs);
    addOption(axisName, value, url, selected);
  }
  return [...axes.values()].filter((a) => a.options.length > 0);
}
function buildImages(productLd, ogImage) {
  const urls = [];
  if (productLd?.image) {
    const imgs = Array.isArray(productLd.image) ? productLd.image : [productLd.image];
    for (const i of imgs) {
      const u = typeof i === "string" ? i : i?.url;
      if (u) urls.push(u);
    }
  }
  if (ogImage && !urls.includes(ogImage)) urls.push(ogImage);
  const seen = /* @__PURE__ */ new Set();
  const images = [];
  urls.forEach((u, idx) => {
    if (seen.has(u)) return;
    seen.add(u);
    images.push({ url: u, order: idx, is_main: idx === 0 });
  });
  return images;
}
function buildExtras(ld) {
  const extras = [];
  for (const obj of ld) {
    if (!ldType(obj).includes("Service")) continue;
    const name = stripTags(obj.name || obj.serviceType || "");
    if (!name) continue;
    const offer = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;
    extras.push({
      name,
      normalized_name: normalizeKey(name),
      price: parsePriceBR(offer?.price),
      currency: offer?.priceCurrency || "BRL",
      url: offer?.url
    });
  }
  return extras;
}
function parseFuturaImProduct(html, sourceUrl) {
  const collectedAt = (/* @__PURE__ */ new Date()).toISOString();
  const warnings = [];
  const errors = [];
  const ld = extractJsonLd(html);
  const productLd = ld.find((o) => ldType(o).includes("Product"));
  const dataLayer = extractDataLayerItem(html);
  const dlItem = dataLayer?.ecommerce?.items?.[0] || dataLayer?.items?.[0] || null;
  if (!productLd && !dlItem) {
    errors.push("P\xE1gina sem JSON-LD de Produto nem dataLayer \u2014 pode exigir navegador (JavaScript).");
  }
  const breadcrumb = extractBreadcrumb(html);
  const ogTitle = html.match(/property=["']?og:title["']?\s+content=["']([^"']+)["']/i)?.[1];
  const ogImage = html.match(/property=["']?og:image["']?\s+content=["']([^"']+)["']/i)?.[1];
  const original_name = decodeEntities(
    productLd?.name || dataLayer?.ecommerce?.items?.[0]?.item_category || ogTitle || ""
  );
  if (!original_name) warnings.push("Nome do produto n\xE3o encontrado.");
  const base_product = breadcrumb.length >= 1 ? breadcrumb[breadcrumb.length === 1 ? 0 : 0] : void 0;
  const external_id = externalIdFromUrl(sourceUrl) || (productLd?.sku != null ? String(productLd.sku) : void 0);
  const description = productLd?.description ? stripTags(productLd.description) : void 0;
  const metaDesc = html.match(/name=["']?description["']?\s+content=["']([^"']+)["']/i)?.[1];
  const short_description = metaDesc ? decodeEntities(metaDesc) : void 0;
  const offer = Array.isArray(productLd?.offers) ? productLd.offers[0] : productLd?.offers;
  const currentPrice = parsePriceBR(offer?.price ?? dlItem?.price);
  const availability = offer?.availability || "";
  const unavailable = /OutOfStock|SoldOut|Discontinued/i.test(availability);
  const available = !unavailable;
  if (unavailable) warnings.push("Produto sinalizado como indispon\xEDvel pelo fornecedor.");
  let rating_average;
  let rating_count;
  if (Array.isArray(productLd?.review) && productLd.review.length) {
    const ratings = productLd.review.map((r) => Number(r?.reviewRating?.ratingValue)).filter((n) => Number.isFinite(n));
    if (ratings.length) {
      rating_count = ratings.length;
      rating_average = parseFloat((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2));
    }
  }
  const price_tiers = extractPriceTiers(html, collectedAt, external_id);
  if (currentPrice > 0) {
    const dlQty = dlItem?.item_name ? parseQuantity(dlItem.item_name) : 0;
    if (dlQty && !price_tiers.some((t) => t.quantity === dlQty)) {
      price_tiers.push({
        quantity: dlQty,
        unit: "unidade",
        total_price: currentPrice,
        unit_price: parseFloat((currentPrice / dlQty).toFixed(4)),
        currency: "BRL",
        available,
        external_id,
        collected_at: collectedAt
      });
      price_tiers.sort((a, b) => a.quantity - b.quantity);
    }
  }
  if (!price_tiers.length) warnings.push("Nenhuma faixa de pre\xE7o por quantidade foi encontrada.");
  const variant_axes = extractVariantAxes(html);
  const multiOption = variant_axes.some((a) => a.options.length > 1);
  const variant_scan_status = multiOption ? "pending" : "selected_only";
  const descriptor = dlItem?.item_name || "";
  const specsRaw = {};
  const findAxisValue = (axis) => {
    const a = variant_axes.find((x) => x.normalized_name === normalizeKey(axis));
    if (!a) return void 0;
    return a.options.find((o) => o.selected)?.value;
  };
  const formatStr = findAxisValue("Formato") || descriptor.match(/(\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|m)?)/i)?.[1] || "";
  const materialStr = findAxisValue("Material") || descriptor.match(/em\s+([^-]+?)(?:\s*-\s*\d|\s*$)/i)?.[1]?.trim() || "";
  const colorStr = findAxisValue("Cor") || descriptor.match(/(\d\s*x\s*\d)/)?.[1] || "";
  if (formatStr) specsRaw["Formato"] = formatStr;
  if (materialStr) specsRaw["Material"] = materialStr;
  if (colorStr) specsRaw["Cor"] = colorStr;
  const dimensions = formatStr ? parseDimensions(formatStr) : void 0;
  const material = materialStr ? parseMaterial(materialStr) : void 0;
  const color = colorStr ? parseColorCode(colorStr) : void 0;
  const specifications = Object.entries(specsRaw).map(([k, v]) => ({
    name: k,
    normalized_name: normalizeKey(k),
    value: v,
    normalized_value: normalizeKey(v)
  }));
  let production_time;
  let prazoText = "";
  const labelM = html.match(/Prazo de produ[\s\S]{0,80}?<strong[^>]*>([^<]+)<\/strong>/i);
  if (labelM) {
    prazoText = cleanText(decodeEntities(labelM[1]));
  }
  if (!prazoText) {
    const dm = decodeEntities(html).match(/(\d+\s*dias?\s*(?:[úu]teis|corridos?)(?:\s*\+\s*frete)?)/i);
    if (dm) prazoText = dm[1];
  }
  if (prazoText) {
    production_time = parseProductionTime(prazoText);
  } else {
    warnings.push("Prazo de produ\xE7\xE3o n\xE3o encontrado no HTML.");
  }
  const images = buildImages(productLd, ogImage);
  if (!images.length) warnings.push("Nenhuma imagem de produto encontrada.");
  const extras = buildExtras(ld);
  const variants = [];
  if (external_id || price_tiers.length) {
    const attrEntries = specifications.map((s) => [s.name, s.value]);
    variants.push({
      external_id,
      sku: external_id,
      title: descriptor || original_name,
      url: sourceUrl,
      canonical_url: offer?.url,
      attributes: specifications,
      material,
      dimensions,
      color,
      production_days: production_time?.production_days,
      available,
      price_tiers,
      raw_attributes: Object.fromEntries(attrEntries)
    });
  }
  if (variant_scan_status === "pending") {
    warnings.push(
      "Existem op\xE7\xF5es de varia\xE7\xE3o n\xE3o varridas (material/formato/cor/acabamento). Importada apenas a variante selecionada."
    );
  }
  const classification = classifyProduct({
    name: original_name,
    breadcrumb,
    specifications: specifications.map((s) => s.value),
    material: material?.original_material,
    description
  });
  const page_type = /\/produto\//i.test(sourceUrl) ? "product" : "unknown";
  if (price_tiers.length) {
    const oldM = html.match(/de\s*R\$\s*([\d.,]+)\s*por/i);
    if (oldM) {
      const old = parsePriceBR(oldM[1]);
      const t = price_tiers[0];
      if (old > t.total_price) {
        t.old_price = old;
        t.discount_percent = discountPercent(old, t.total_price);
      }
    }
  }
  return {
    page_type,
    source_url: sourceUrl,
    canonical_url: offer?.url,
    external_id,
    supplier: FUTURAIM_SUPPLIER,
    supplier_domain: "futuraim.com.br",
    brand: productLd?.brand?.name || dlItem?.item_brand || FUTURAIM_SUPPLIER,
    original_name,
    normalized_name: cleanText(original_name),
    slug: slugify(original_name),
    breadcrumb,
    base_product,
    short_description,
    description,
    specifications,
    available,
    unavailable,
    is_on_sale: price_tiers.some((t) => t.discount_percent && t.discount_percent > 0),
    production_time,
    rating_average,
    rating_count,
    classification,
    variant_axes,
    variants,
    variant_scan_status,
    images,
    templates: [],
    extras,
    collected_at: collectedAt,
    warnings,
    errors
  };
}

// scripts/diag-parser.ts
var __dirname = dirname(fileURLToPath(import.meta.url));
var dir = join(__dirname, "..", "src", "services", "__tests__", "fixtures");
for (const f of readdirSync(dir).filter((f2) => f2.endsWith(".html"))) {
  const html = readFileSync(join(dir, f), "utf8");
  const p = parseFuturaImProduct(html, `https://www.futuraim.com.br/produto/${f.replace(/\.html$/, "")}?id=1`);
  console.log("\n=====", f, "=====");
  console.log("name:", JSON.stringify(p.original_name));
  console.log("external_id:", p.external_id, "| available:", p.available);
  const tiers = p.variants[0]?.price_tiers || [];
  console.log("price_tiers:", tiers.length, "->", tiers.map((t) => `${t.quantity}=R$${t.total_price}`).join(", "));
  console.log("variant_axes:", p.variant_axes.length, "scan_status:", p.variant_scan_status);
  for (const a of p.variant_axes) {
    console.log(
      `  - ${a.name} (${a.options.length}): ` + a.options.map((o) => `${o.value}${o.external_id ? "#" + o.external_id : ""}${o.selected ? "*" : ""}`).slice(0, 10).join(" | ") + (a.options.length > 10 ? " ..." : "")
    );
  }
  console.log("extras:", p.extras.length, "| images:", p.images.length, "| templates:", p.templates.length);
  console.log("warnings:", p.warnings.length ? p.warnings.join(" ;; ") : "(none)");
  console.log("errors:", p.errors.length ? p.errors.join(" ;; ") : "(none)");
}
