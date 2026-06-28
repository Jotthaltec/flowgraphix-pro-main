/**
 * Classificador de produtos gráficos (seções 21–24 da especificação).
 *
 * Produz: categoria principal + subcategoria + confiança (0–100) + motivo +
 * tags + segmentos + setor de produção. Regras-chave:
 *  - Segmento de mercado NÃO é categoria (seção 22).
 *  - Técnica de produção NÃO é categoria (seção 23).
 *  - Confiança < 80 marca "revisão necessária" (seção 24).
 *
 * Ordem de confiança das fontes (seção 24): nome > breadcrumb > especificações
 * > material > técnica > descrição > segmento.
 */

import type { ImportedClassification } from "@/types/importedProduct";
import { deburr } from "@/services/productNormalizer";

export interface ClassificationInput {
  name: string;
  breadcrumb?: string[];
  specifications?: string[]; // valores textuais relevantes
  material?: string;
  description?: string;
}

interface SubcatDef {
  name: string;
  /** termos que identificam a subcategoria (sem acento, minúsculo). */
  keywords: string[];
}

interface CategoryDef {
  category: string;
  subcategories: SubcatDef[];
}

// Árvore inicial (seção 21). Ordem importa: itens mais específicos primeiro.
export const CATEGORY_TREE: CategoryDef[] = [
  {
    category: "Adesivos e Rótulos",
    subcategories: [
      { name: "DTF UV", keywords: ["dtf uv", "dtfuv", "dtf - uv"] },
      { name: "Adesivo em Vinil", keywords: ["adesivo em vinil", "adesivo vinil", "vinil adesivo"] },
      { name: "Adesivo Perfurado", keywords: ["adesivo perfurado", "perfurado"] },
      { name: "Adesivo Holográfico", keywords: ["adesivo holografico", "holografico"] },
      { name: "Adesivo Eletrostático", keywords: ["eletrostatico"] },
      { name: "Adesivo de Recorte", keywords: ["adesivo de recorte", "recorte eletronico"] },
      { name: "Adesivo Resinado", keywords: ["resinado", "resina"] },
      { name: "Rótulo em Bobina", keywords: ["rotulo em bobina", "bobina"] },
      { name: "Rótulo", keywords: ["rotulo"] },
      { name: "Etiqueta", keywords: ["etiqueta"] },
      { name: "Sticker", keywords: ["sticker"] },
      { name: "Adesivo", keywords: ["adesivo"] },
    ],
  },
  {
    category: "Vestuário e Têxtil",
    subcategories: [
      { name: "DTF Têxtil", keywords: ["dtf textil", "dtf têxtil", "dtf para tecido", "transfer dtf"] },
      { name: "Camiseta", keywords: ["camiseta", "dry fit", "baby look"] },
      { name: "Camisa", keywords: ["camisa", "polo"] },
      { name: "Moletom", keywords: ["moletom", "blusa de frio"] },
      { name: "Boné", keywords: ["bone", "boné"] },
      { name: "Avental", keywords: ["avental"] },
      { name: "Uniforme", keywords: ["uniforme"] },
      { name: "Abadá", keywords: ["abada"] },
      { name: "Tecido Impresso", keywords: ["tecido impresso", "tecido personalizado"] },
    ],
  },
  {
    category: "Comunicação Visual",
    subcategories: [
      { name: "Wind Banner", keywords: ["wind banner", "windbanner", "fly banner"] },
      { name: "Banner", keywords: ["banner", "faixa lona"] },
      { name: "Faixa", keywords: ["faixa"] },
      { name: "Backdrop", keywords: ["backdrop", "painel de fundo"] },
      { name: "Painel", keywords: ["painel"] },
      { name: "Adesivo para Vitrine", keywords: ["vitrine"] },
      { name: "Papel de Parede", keywords: ["papel de parede"] },
      { name: "Sinalização", keywords: ["sinalizacao"] },
      { name: "Display", keywords: ["display"] },
    ],
  },
  {
    category: "Embalagens e Sacolas",
    subcategories: [
      { name: "Sacola de Papel", keywords: ["sacola de papel", "sacola kraft"] },
      { name: "Sacola Plástica", keywords: ["sacola plastica", "sacola plástica"] },
      { name: "Ecobag", keywords: ["ecobag", "eco bag", "sacola retornavel"] },
      { name: "Caixa", keywords: ["caixa", "embalagem delivery", "box"] },
      { name: "Cinta", keywords: ["cinta"] },
      { name: "Solapa", keywords: ["solapa"] },
      { name: "Fita", keywords: ["fita personalizada", "fita de cetim"] },
      { name: "Envelope de Embalagem", keywords: ["envelope de embalagem", "envelope plastico"] },
    ],
  },
  {
    category: "Editorial",
    subcategories: [
      { name: "Revista", keywords: ["revista"] },
      { name: "Livro", keywords: ["livro"] },
      { name: "Apostila", keywords: ["apostila"] },
      { name: "Manual", keywords: ["manual"] },
      { name: "Catálogo", keywords: ["catalogo"] },
    ],
  },
  {
    category: "Papelaria Corporativa",
    subcategories: [
      { name: "Papel Timbrado", keywords: ["papel timbrado", "timbrado"] },
      { name: "Envelope", keywords: ["envelope"] },
      { name: "Pasta", keywords: ["pasta"] },
      { name: "Bloco Autocopiativo", keywords: ["autocopiativo", "bloco autocopiativo"] },
      { name: "Talão", keywords: ["talao", "talão", "nota fiscal", "recibo"] },
      { name: "Bloco", keywords: ["bloco", "bloco de anotacoes"] },
      { name: "Receituário", keywords: ["receituario", "receituário"] },
      { name: "Agenda", keywords: ["agenda"] },
      { name: "Caderno", keywords: ["caderno", "caderneta"] },
      { name: "Marcador de Página", keywords: ["marcador de pagina", "marca pagina"] },
      { name: "Carimbo", keywords: ["carimbo"] },
      { name: "Credencial", keywords: ["credencial", "cracha", "crachá"] },
    ],
  },
  {
    category: "Impressos Promocionais",
    subcategories: [
      { name: "Mini Cartão", keywords: ["mini cartao", "minicard"] },
      { name: "Cartão Fidelidade", keywords: ["cartao fidelidade", "fidelidade"] },
      { name: "Cartão de Visita", keywords: ["cartao de visita", "cartão de visita"] },
      { name: "Folder", keywords: ["folder"] },
      { name: "Panfleto", keywords: ["panfleto"] },
      { name: "Folheto", keywords: ["folheto"] },
      { name: "Postal", keywords: ["postal", "cartao postal"] },
      { name: "Cartaz e Pôster", keywords: ["cartaz", "poster", "pôster"] },
      { name: "Convite", keywords: ["convite"] },
      { name: "Certificado", keywords: ["certificado", "diploma"] },
      { name: "Cardápio", keywords: ["cardapio", "cardápio"] },
    ],
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
      { name: "Imã", keywords: ["ima", "imã", "ima de geladeira"] },
      { name: "Mouse Pad", keywords: ["mouse pad", "mousepad"] },
      { name: "Capinha", keywords: ["capinha", "case celular"] },
      { name: "Azulejo", keywords: ["azulejo"] },
      { name: "Régua", keywords: ["regua", "régua"] },
    ],
  },
  {
    category: "Placas e Sinalização",
    subcategories: [
      { name: "Placa em PVC", keywords: ["placa em pvc", "placa pvc"] },
      { name: "Placa em PS", keywords: ["placa em ps", "placa ps"] },
      { name: "Placa em Acrílico", keywords: ["placa em acrilico", "placa acrilico"] },
      { name: "Placa em Polionda", keywords: ["placa em polionda", "polionda"] },
      { name: "Placa Imobiliária", keywords: ["placa imobiliaria"] },
      { name: "Placa", keywords: ["placa"] },
    ],
  },
  {
    category: "Ponto de Venda",
    subcategories: [
      { name: "Wobbler", keywords: ["wobbler"] },
      { name: "Móbile", keywords: ["mobile", "móbile"] },
      { name: "Faixa de Gôndola", keywords: ["gondola", "gôndola"] },
      { name: "Plaquinha de Preço", keywords: ["plaquinha de preco", "preco de gondola"] },
      { name: "Porta-copos", keywords: ["porta-copos", "porta copos", "bolacha de chopp"] },
    ],
  },
];

// Segmentos (seção 22) — viram tag/segment, NUNCA categoria.
const SEGMENT_KEYWORDS: Array<{ segment: string; keywords: string[] }> = [
  { segment: "Restaurante/Pizzaria", keywords: ["pizzaria", "restaurante", "lanchonete", "delivery", "hamburgueria"] },
  { segment: "Clínica/Saúde", keywords: ["clinica", "clínica", "consultorio", "dentista", "medico"] },
  { segment: "Escola/Educação", keywords: ["escola", "faculdade", "educacao"] },
  { segment: "Academia/Fitness", keywords: ["academia", "fitness", "crossfit"] },
  { segment: "Pet Shop", keywords: ["pet shop", "petshop", "pet"] },
  { segment: "Loja de Roupa/Moda", keywords: ["loja de roupa", "moda", "boutique"] },
  { segment: "Casamento", keywords: ["casamento", "noivos"] },
  { segment: "Festa/Evento", keywords: ["festa", "aniversario", "evento"] },
  { segment: "Empresarial", keywords: ["empresa", "corporativo"] },
];

// Setor de produção / técnica (seção 23).
const TECHNIQUE_KEYWORDS: Array<{ sector: string; keywords: string[] }> = [
  { sector: "DTF UV", keywords: ["dtf uv"] },
  { sector: "DTF Têxtil", keywords: ["dtf textil", "dtf têxtil", "dtf para tecido"] },
  { sector: "Sublimação", keywords: ["sublimacao", "sublimático", "caneca", "azulejo"] },
  { sector: "Eco-solvente", keywords: ["eco-solvente", "eco solvente", "lona", "banner"] },
  { sector: "Serigrafia", keywords: ["serigrafia", "silk"] },
  { sector: "Laser", keywords: ["gravacao laser", "corte a laser"] },
  { sector: "UV Direto", keywords: ["uv direto", "impressao uv"] },
  { sector: "Corte Eletrônico", keywords: ["corte eletronico", "recorte"] },
  { sector: "Offset", keywords: ["offset", "couche", "couché"] },
  { sector: "Impressão Digital", keywords: ["impressao digital", "digital"] },
];

function has(haystack: string, term: string): boolean {
  return haystack.includes(deburr(term).toLowerCase());
}

/**
 * Classifica um produto. Não inventa categoria: se nada casar, retorna
 * "Não classificado" com confiança baixa e review_required = true.
 */
export function classifyProduct(input: ClassificationInput): ImportedClassification {
  const name = deburr(input.name || "").toLowerCase();
  const breadcrumb = (input.breadcrumb || []).map((b) => deburr(b).toLowerCase());
  const specs = (input.specifications || []).map((s) => deburr(s).toLowerCase()).join(" ");
  const material = deburr(input.material || "").toLowerCase();
  const description = deburr(input.description || "").toLowerCase();

  interface Match {
    category: string;
    subcategory: string;
    confidence: number;
    source: string;
  }
  const matches: Match[] = [];

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
          source = "especificações";
        } else if (has(material, kw)) {
          confidence = 70;
          source = "material";
        } else if (has(description, kw)) {
          confidence = 60;
          source = "descrição";
        }
        if (confidence > 0) {
          matches.push({ category: cat.category, subcategory: sub.name, confidence, source });
        }
      }
    }
  }

  const best: Match | null = matches.length
    ? matches.reduce((a, b) => (b.confidence > a.confidence ? b : a))
    : null;

  // Segmentos (tags, nunca categoria)
  const fullText = `${name} ${breadcrumb.join(" ")} ${specs} ${description}`;
  const segments = SEGMENT_KEYWORDS.filter((s) => s.keywords.some((k) => has(fullText, k))).map(
    (s) => s.segment,
  );

  // Setor de produção / técnica
  let production_sector = "Não identificado";
  for (const t of TECHNIQUE_KEYWORDS) {
    if (t.keywords.some((k) => has(fullText, k) || has(material, k))) {
      production_sector = t.sector;
      break;
    }
  }

  if (!best) {
    return {
      category: "Não classificado",
      subcategory: "Geral",
      confidence: 0,
      reason: "Nenhuma palavra-chave de categoria foi reconhecida no produto.",
      tags: [],
      segments,
      production_sector,
      review_required: true,
    };
  }

  // Tags = subcategoria + segmentos + técnica
  const tags = Array.from(
    new Set([best.subcategory, ...segments, production_sector !== "Não identificado" ? production_sector : ""]),
  ).filter(Boolean);

  return {
    category: best.category,
    subcategory: best.subcategory,
    confidence: best.confidence,
    reason: `Classificado como "${best.subcategory}" (categoria ${best.category}) a partir de: ${best.source}.`,
    tags,
    segments,
    production_sector,
    review_required: best.confidence < 80,
  };
}
