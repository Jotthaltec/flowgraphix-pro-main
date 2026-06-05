import { supabase } from "@/integrations/supabase/client";
import { generateMarketplaceCopy } from "@/lib/marketplace-copy-generator";

export interface ImportedProductInput {
  id?: string;
  product_name: string;
  category: string;
  subcategory?: string;
  supplier_sku?: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  source_url?: string;
  current_price: number;
  production_deadline?: string;
  main_image_url?: string;
  gallery_images?: string[];
  specifications?: Record<string, string>;
  variations?: any[];
  quantity_prices?: any[];
  extra_services?: any[];
  template_links?: any[];
  unit?: string;
  minimum_quantity?: number;
}

/**
 * Normaliza e salva um produto importado no catálogo (Products & Services) usando Upsert.
 */
export async function saveImportedProductToCatalog(
  importedProduct: ImportedProductInput,
  marginPercent: number,
  companyId: string
): Promise<string> {
  // 1. Normalização de campos
  const baseCost = importedProduct.current_price || 0;
  const margin = marginPercent || 45;
  
  // 2. Calcula preço de venda com a margem (Markup simples)
  const salePrice = parseFloat((baseCost * (1 + margin / 100)).toFixed(2));
  const suggestedPrice = salePrice;
  const minPrice = parseFloat((salePrice * 0.9).toFixed(2));

  // 3. Gera SKU interno se não houver
  const cleanName = importedProduct.product_name || "Sem Nome";
  let internalSku = importedProduct.supplier_sku 
    ? `HUB-${importedProduct.supplier_sku}` 
    : `HUB-${cleanName.substring(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // 4. Copias de Marketplace (geradas a partir da API local)
  const copy = generateMarketplaceCopy(
    "mercado_livre",
    cleanName,
    baseCost,
    margin,
    importedProduct.specifications || {},
    importedProduct.production_deadline || "5 dias úteis"
  );
  
  const marketplaceTitle = copy.title;
  const marketplaceDescription = copy.description;

  // 5. Normalizar especificações, variações e tiragens
  const specifications = importedProduct.specifications || {};
  const variations = importedProduct.variations || [];
  const galleryImages = importedProduct.gallery_images || [];
  const templateLinks = importedProduct.template_links || [];
  
  // Mapeia tiragens (quantity_prices) para a coluna quantity_price_table
  const quantityPriceTable = (importedProduct.quantity_prices || []).map(qp => {
    const factor = 1 + margin / 100;
    const sellPrice = qp.sellPrice || parseFloat((qp.price * factor).toFixed(2));
    return {
      quantity: qp.quantity,
      price: qp.price,
      unitPrice: qp.unitPrice || parseFloat((qp.price / qp.quantity).toFixed(4)),
      sellPrice: sellPrice,
      unitSellPrice: parseFloat((sellPrice / qp.quantity).toFixed(4))
    };
  });

  // 6. Estrutura o registro para a tabela products
  const productData: any = {
    company_id: companyId,
    name: cleanName,
    commercial_name: cleanName,
    type: "product",
    origin: "supplier_import",
    supplier_id: importedProduct.supplier_id || null,
    supplier_name: importedProduct.supplier_name || null,
    source_url: importedProduct.source_url || null,
    supplier_sku: importedProduct.supplier_sku || null,
    internal_sku: internalSku,
    category: importedProduct.category || "Impressos",
    subcategory: importedProduct.subcategory || "Geral",
    description: specifications["Descrição"] || cleanName,
    technical_description: specifications["Instruções"] || specifications["Detalhes"] || null,
    marketplace_title: marketplaceTitle,
    marketplace_description: marketplaceDescription,
    image_url: importedProduct.main_image_url || null,
    main_image_url: importedProduct.main_image_url || null,
    gallery_images: galleryImages,
    cost_price: baseCost,
    base_cost: baseCost,
    margin_percent: margin,
    target_margin: margin,
    sale_price: salePrice,
    suggested_price: suggestedPrice,
    min_price: minPrice,
    unit: importedProduct.unit || "unidade",
    unit_measure: importedProduct.unit || "Unidade",
    minimum_quantity: importedProduct.minimum_quantity || 1,
    quantity_price_table: quantityPriceTable,
    quantity_prices: quantityPriceTable,
    specifications: specifications,
    variations: variations,
    template_links: templateLinks,
    production_deadline: importedProduct.production_deadline || "5 dias úteis",
    avg_production_time: importedProduct.production_deadline || "5 dias úteis",
    active: true,
    imported_from_supplier: true,
    import_status: "imported",
    updated_at: new Date().toISOString()
  };

  // 7. Resolve o Upsert baseado nos critérios
  let existingProductId = importedProduct.id || null;

  if (!existingProductId) {
    // Critério 1: SKU + Fornecedor
    if (importedProduct.supplier_sku && importedProduct.supplier_id) {
      const { data } = await supabase
        .from("products")
        .select("id, internal_sku")
        .eq("supplier_sku", importedProduct.supplier_sku)
        .eq("supplier_id", importedProduct.supplier_id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (data) {
        existingProductId = data.id;
        productData.internal_sku = data.internal_sku;
      }
    }
  }

  if (!existingProductId && importedProduct.source_url) {
    // Critério 2: URL de origem
    const { data } = await supabase
      .from("products")
      .select("id, internal_sku")
      .eq("source_url", importedProduct.source_url)
      .eq("company_id", companyId)
      .maybeSingle();
    if (data) {
      existingProductId = data.id;
      productData.internal_sku = data.internal_sku;
    }
  }

  if (existingProductId) {
    // Atualiza produto existente
    const { error } = await supabase
      .from("products")
      .update(productData)
      .eq("id", existingProductId);
    if (error) throw error;
    return existingProductId;
  } else {
    // Cria novo produto
    const { data, error } = await supabase
      .from("products")
      .insert({
        ...productData,
        created_at: new Date().toISOString()
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }
}

/**
 * Busca por produtos com nomes semelhantes cadastrados para evitar duplicidades.
 */
export async function findSimilarProducts(
  name: string,
  companyId: string
): Promise<Array<{ id: string; name: string; commercial_name: string | null; supplier_sku: string | null }>> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, commercial_name, supplier_sku")
    .eq("company_id", companyId);

  if (error || !data) return [];

  const cleanString = (str: string) => 
    str.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const targetClean = cleanString(name);

  return data.filter(p => {
    const nameClean = cleanString(p.name);
    const commClean = p.commercial_name ? cleanString(p.commercial_name) : "";
    
    if (targetClean === nameClean || (commClean && targetClean === commClean)) return true;
    
    if (targetClean.length > 5 && nameClean.length > 5 && (targetClean.includes(nameClean) || nameClean.includes(targetClean))) {
      return true;
    }
    return false;
  });
}
