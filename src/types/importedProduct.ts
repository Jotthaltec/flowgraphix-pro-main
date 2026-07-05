/**
 * Modelo de dados do IMPORTADOR DE PRODUTOS POR LINK.
 *
 * Estes tipos descrevem o produto **estruturado** que o importador produz a
 * partir de uma página de fornecedor (inicialmente FuturaIM). Eles seguem a
 * especificação do módulo: material, formato, cor e acabamento ficam SEMPRE em
 * campos separados — nunca concatenados no nome do produto — e o segmento de
 * mercado nunca é tratado como categoria principal.
 *
 * Nenhum dado aqui é fabricado: tudo é preenchido a partir do que a página
 * realmente expõe. Campos sem dado ficam `undefined`/vazios e geram avisos.
 */

// ---------------------------------------------------------------------------
// Enums / unions
// ---------------------------------------------------------------------------

/** Tipo de página detectado a partir da URL + conteúdo. */
export type ImportPageType =
  | "product" // /produto/...?id=NNN
  | "catalog" // /todos-os-produtos, página de categoria
  | "family" // família de produto (variações apontando p/ vários ids)
  | "unknown";

/** Modo de importação escolhido pelo usuário. */
export type ImportMode = "single" | "batch" | "catalog" | "price_update";

/** Status de um item de importação (espelha a seção 29 da spec). */
export type ImportItemStatus =
  | "pendente"
  | "analisando"
  | "extraido"
  | "revisao_necessaria"
  | "pronto_para_importar"
  | "importando"
  | "importado"
  | "atualizado"
  | "ignorado"
  | "erro"
  | "bloqueado";

/** Estado da varredura de variantes (seção 10). */
export type VariantScanStatus =
  | "complete" // todas as combinações reais foram coletadas
  | "selected_only" // apenas a variante atualmente selecionada foi coletada
  | "pending"; // existem opções não varridas

// ---------------------------------------------------------------------------
// Sub-estruturas
// ---------------------------------------------------------------------------

/** Atributo dinâmico genérico (seção 8). Preserva o texto original e a versão normalizada. */
export interface ImportedAttribute {
  name: string;
  normalized_name: string;
  value: string;
  normalized_value: string;
}

/** Medidas/formato normalizados para mm quando possível (seção 12). */
export interface ImportedDimensions {
  original: string;
  width?: number;
  height?: number;
  depth?: number;
  unit?: "mm" | "cm" | "m" | "ml" | "custom" | "size_label" | string;
  width_mm?: number;
  height_mm?: number;
  depth_mm?: number;
  /** true quando é "tamanho personalizado", P/M/G/GG, capacidade em ml, etc. */
  is_special?: boolean;
  note?: string;
}

/** Interpretação de cor de impressão (seção 13). Nada é deduzido sem confirmação. */
export interface ImportedColorSpec {
  original_color_code: string; // ex.: "4x4"
  front_colors?: number; // ex.: 4
  back_colors?: number; // ex.: 4
  front_printed?: boolean;
  back_printed?: boolean;
  has_white_ink?: boolean;
  description?: string;
}

/** Material e propriedades separadas (seção 14). O texto original nunca é descartado. */
export interface ImportedMaterial {
  original_material: string;
  material_family?: string; // ex.: "Couché"
  surface?: string; // ex.: "Brilho" / "Fosco"
  grammage_gsm?: number; // ex.: 300
  thickness_mm?: number; // ex.: 4
  color?: string; // ex.: "Branca"
  composition?: string; // ex.: "Poliéster"
}

/** Faixa de preço por quantidade (seção 11). Moeda já normalizada para número. */
export interface ImportedPriceTier {
  quantity: number;
  unit: string; // "unidade", "folha", "m²", ...
  total_price: number;
  unit_price: number;
  old_price?: number;
  promotional_price?: number;
  discount_percent?: number;
  currency: string; // "BRL"
  available?: boolean;
  extra_days?: number;
  /** id externo do SKU correspondente a esta faixa (FuturaIM usa 1 id por tiragem). */
  external_id?: string;
  collected_at: string;
}

/** Imagem do produto (seção 17). */
export interface ImportedImage {
  url: string;
  hires_url?: string;
  alt?: string;
  order: number;
  is_main: boolean;
}

/** Gabarito/arquivo de apoio (seção 16). Não é baixado durante a análise. */
export interface ImportedTemplate {
  type: string; // "PDF", "CorelDRAW", "Illustrator", "Canva", ...
  name: string;
  url: string;
  format?: string; // extensão
  variant_external_id?: string;
  collected_at: string;
}

/** Serviço adicional / extra (seção 20). Não altera o preço-base. */
export interface ImportedExtra {
  name: string;
  normalized_name: string;
  price: number;
  currency: string;
  extra_days?: number;
  url?: string;
}

/** Eixo de variação disponível na página (lista de opções, com ids reais quando houver). */
export interface ImportedVariantAxis {
  name: string;
  normalized_name: string;
  options: Array<{
    value: string;
    normalized_value: string;
    external_id?: string;
    url?: string;
    selected?: boolean;
    /**
     * Preço REAL desta opção (custo do fornecedor), preenchido só após a
     * varredura completa de variantes — cada opção aponta para uma combinação
     * (`?id=`) com sua própria tabela de tiragens. Sem varredura ficam undefined
     * e a UI herda o custo-base do produto.
     */
    unit_price?: number; // custo unitário na tiragem de referência
    total_price?: number; // custo total da tiragem de referência
    ref_quantity?: number; // quantidade da tiragem usada como referência
  }>;
}

/** Variante concreta — criada apenas com id/SKU/URL reais (seções 9 e 10). */
export interface ImportedVariant {
  external_id?: string;
  sku?: string;
  title: string;
  url?: string;
  canonical_url?: string;
  attributes: ImportedAttribute[];
  material?: ImportedMaterial;
  dimensions?: ImportedDimensions;
  color?: ImportedColorSpec;
  finishing?: string[];
  enoblement?: string[];
  production_days?: number;
  available: boolean;
  price_tiers: ImportedPriceTier[];
  raw_attributes: Record<string, string>;
}

/** Resultado da classificação (seções 21–24). */
export interface ImportedClassification {
  category: string;
  subcategory: string;
  confidence: number; // 0–100
  reason: string;
  tags: string[];
  segments: string[];
  production_sector: string; // seção 23 ("Offset", "DTF UV", "Sublimação", ...)
  review_required: boolean; // true quando confiança < 80
}

/** Prazo de produção decomposto (seção 19). */
export interface ImportedProductionTime {
  /** Dias de produção do FORNECEDOR (coletado, somente leitura). */
  production_days?: number;
  production_day_type?: "business_days" | "calendar_days";
  freight_not_included?: boolean;
  original_production_time?: string;
  /** Nossos dias de produção (editável pelo usuário) — somados aos do fornecedor. */
  our_production_days?: number;
  /** Total = fornecedor + nossos (calculado). */
  total_production_days?: number;
}

// ---------------------------------------------------------------------------
// Produto importado (resultado completo do parser/normalizer/classifier)
// ---------------------------------------------------------------------------

export interface ImportedProduct {
  // Origem / rastreabilidade
  page_type: ImportPageType;
  source_url: string;
  canonical_url?: string;
  external_id?: string;
  supplier: string; // "FuturaIM"
  supplier_domain: string;
  brand?: string;

  // Identificação
  original_name: string;
  normalized_name: string;
  slug?: string;
  breadcrumb: string[];
  department?: string;
  base_product?: string; // produto-base (família), ex.: "Cartão de Visita"

  // Conteúdo (seção 18) — separado, nunca misturado
  short_description?: string;
  description?: string;
  important_info?: string;
  specifications: ImportedAttribute[];

  // Disponibilidade / flags
  available: boolean;
  is_new?: boolean;
  is_on_sale?: boolean;
  unavailable?: boolean;
  express_production?: boolean;
  production_time?: ImportedProductionTime;

  // Avaliações (opcional, não copiamos textos/dados pessoais — só agregados)
  rating_average?: number;
  rating_count?: number;

  // Classificação
  classification: ImportedClassification;

  // Variações
  variant_axes: ImportedVariantAxis[];
  variants: ImportedVariant[];
  variant_scan_status: VariantScanStatus;

  // Mídia / arquivos / extras
  images: ImportedImage[];
  templates: ImportedTemplate[];
  extras: ImportedExtra[];

  // Datas
  collected_at: string;
  updated_at?: string;

  // Diagnóstico
  warnings: string[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Resultado de validação de URL (seção 4 — anti-SSRF / allowlist)
// ---------------------------------------------------------------------------

export interface UrlValidationResult {
  ok: boolean;
  url?: string;
  domain?: string;
  page_type?: ImportPageType;
  external_id?: string;
  reason?: string; // motivo da rejeição quando ok=false
}
