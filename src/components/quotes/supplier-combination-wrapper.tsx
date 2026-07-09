import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';
import { SupplierCombinationSelector } from './supplier-combination-selector';
import { getFamilyCombinationDataClient } from '@/integrations/supabase/combination-client';

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
  // Carrega os dados da família (cascata + produtos comerciais + promoções)
  // client-side, com o client autenticado (RLS via user_owns_company).
  const { data, isLoading, error } = useQuery({
    queryKey: ['familyCombinationData', familyId, companyId],
    queryFn: async () => {
      return await getFamilyCombinationDataClient(familyId, companyId);
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
