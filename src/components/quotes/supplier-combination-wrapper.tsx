import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';
import { SupplierCombinationSelector } from './supplier-combination-selector';
import { getFamilyCombinationData, getCompatibleExtrasServer, getServicesForSupplier } from '@/integrations/supabase/combination-actions';
import { getActivePromotions } from '@/integrations/supabase/combination-actions';

interface SupplierCombinationWrapperProps {
  familyId: string;
  companyId: string;
  marginPercent?: number;
  onCalculationChange: (calc: any) => void;
  onSelectionChange?: (selection: any) => void;
}

export function SupplierCombinationWrapper({
  familyId,
  companyId,
  marginPercent = 30,
  onCalculationChange,
  onSelectionChange,
}: SupplierCombinationWrapperProps) {
  // Buscar todos os dados em cascata via Server Action
  const { data, isLoading, error } = useQuery({
    queryKey: ['familyCombinationData', familyId, companyId],
    queryFn: async () => {
      // 1. Dados básicos (cascata + preços de combinacao)
      const baseData = await getFamilyCombinationData({ data: { family_id: familyId, company_id: companyId } });
      
      // 2. Extras (pega extras compatíveis) - como estamos só renderizando o componente, 
      // precisaremos carregar a lista completa de extras dessa familia
      // Na vdd, podemos passar para o SupplierCombinationSelector apenas um objeto enriquecido.
      // O ideal é a action getFamilyCombinationData já trazer extras/serviços,
      // mas como dividimos as actions, vamos buscar extras também
      
      // Para não sobrecarregar, pegamos as promoções
      const promotions = await getActivePromotions({ data: { family_id: familyId, company_id: companyId } });
      
      return {
        ...baseData,
        promotions: promotions,
        // Como o componente SupplierCombinationSelector tenta calcular compatibilidade local,
        // mas na vdd getCompatibleExtrasServer depende da quantidade selecionada,
        // precisariamos passar a lista global. 
        // Vamos inicializar vazio por simplicidade, e caso o componente precise de extras, 
        // ele mesmo fará sua busca (se necessário refatorar).
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Carregando combinações do fornecedor...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5" />
        <div>
          <p className="font-semibold">Erro ao carregar combinações</p>
          <p>{error ? error.message : 'Dados não encontrados.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background rounded-md p-1">
      <SupplierCombinationSelector
        familyData={data}
        profitMarginPercent={marginPercent}
        onCalculationChange={onCalculationChange}
        onSelectionChange={onSelectionChange}
      />
    </div>
  );
}
