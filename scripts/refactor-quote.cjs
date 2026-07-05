const fs = require('fs');
let code = fs.readFileSync('src/components/quotes/quote-item-builder.tsx', 'utf-8');

// 1. Adicionar os imports necessarios
code = code.replace(
  'import { StatusBadge } from "@/components/status-badge";',
  'import { StatusBadge } from "@/components/status-badge";\nimport { SupplierCombinationWrapper } from "./supplier-combination-wrapper";\nimport { useAuth } from "@/hooks/use-auth";'
);

// 2. Modificar QuoteItemData para suportar os novos calculos
code = code.replace(
  'margin_percent: number;\n}',
  'margin_percent: number;\n  // New Combination Engine\n  has_combination_engine?: boolean;\n  family_id?: string;\n  calc_snapshot?: any;\n}'
);

// 3. Modificar a query products_catalog_quote para trazer o family_id
code = code.replace(
  'quantity_prices, quantity_price_table',
  'quantity_prices, quantity_price_table, supplier_product_families(id)'
);

// 4. No addItem, detectar se tem family_id
const oldAddItem = 'const isSupplier = !!(product && (product.imported_from_supplier === true || product.origin === "supplier_import"));';
const newAddItem = `const isSupplier = !!(product && (product.imported_from_supplier === true || product.origin === "supplier_import"));
    const familyId = product?.supplier_product_families?.[0]?.id || null;
    const hasCombinationEngine = !!familyId;`;
code = code.replace(oldAddItem, newAddItem);

const oldNewItem = 'is_supplier: isSupplier,';
const newNewItem = 'is_supplier: isSupplier,\n      has_combination_engine: hasCombinationEngine,\n      family_id: familyId,';
code = code.replace(oldNewItem, newNewItem);

// 5. Na renderização (após fechar), renderizar o Wrapper se has_combination_engine
const oldRender = '          {/* Faixas de quantidade reais do fornecedor (seção 7) */}';
const newRender = `          {/* Se usar o motor de combinações */}
          {editingItem.has_combination_engine && editingItem.family_id ? (
            <div className="pt-2 border-t mt-2">
              <SupplierCombinationWrapper
                familyId={editingItem.family_id}
                companyId={profile?.company_id || ""}
                marginPercent={editingItem.margin_percent_target || 30}
                onCalculationChange={(calc) => {
                  if (!calc) return;
                  updateItem(editingIdx, {
                    unit_cost: calc.unit_price_display, // display na UI
                    unit_price: calc.final_sale_price / calc.quantity,
                    quantity: calc.quantity,
                    total_cost: calc.total_supplier_cost,
                    total_price: calc.final_sale_price,
                    margin_percent: calc.margin_percent,
                    calc_snapshot: calc
                  });
                }}
                onSelectionChange={(sel) => {
                  updateItem(editingIdx, { selection_snapshot: sel as any });
                }}
              />
            </div>
          ) : (
            <>
              {/* Faixas de quantidade reais do fornecedor (seção 7) */}`;
code = code.replace(oldRender, newRender);

const oldRenderClose = '          {/* Componente Desktop: Grid com Labels */}';
const newRenderClose = `            </>
          )}
          
          {/* Componente Desktop: Grid com Labels */}`;
code = code.replace(oldRenderClose, newRenderClose);

// Pegar o profile para o companyId (adicionar hook ao componente)
code = code.replace(
  'function QuoteItemBuilder({ items, onItemsChange }: QuoteItemBuilderProps) {',
  'export function QuoteItemBuilder({ items, onItemsChange }: QuoteItemBuilderProps) {\n  const { profile } = useAuth();'
);
// Tem um export na declaracao function QuoteItemBuilder na source
code = code.replace(
  'export export function',
  'export function'
);

fs.writeFileSync('src/components/quotes/quote-item-builder.tsx', code);
console.log('Modified quote-item-builder.tsx');
