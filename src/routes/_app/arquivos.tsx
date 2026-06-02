import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { FileImage, Upload, Download, Loader2, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useRef } from "react";

export const Route = createFileRoute("/_app/arquivos")({ component: ArquivosPage });

function ArquivosPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: files, isLoading } = useQuery({
    queryKey: ["storage_files"],
    queryFn: async () => {
      // Create bucket 'arquivos' if it doesn't exist (usually handled in Supabase dashboard, but we attempt list)
      const { data, error } = await supabase.storage.from('arquivos').list(profile?.company_id || 'shared', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });
      
      // Se der erro porque o bucket não existe ou RLS bloqueou, retornamos vazio para não quebrar a tela
      if (error) {
        console.error("Storage error:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!profile,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const filePath = `${profile?.company_id || 'shared'}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('arquivos').upload(filePath, file);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage_files"] });
      toast.success("Arquivo enviado com sucesso!");
    },
    onError: (err) => {
      toast.error("Erro no upload (Verifique se o bucket 'arquivos' existe e é público/acessível): " + err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileName: string) => {
      const filePath = `${profile?.company_id || 'shared'}/${fileName}`;
      const { error } = await supabase.storage.from('arquivos').remove([filePath]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage_files"] });
      toast.success("Arquivo removido.");
    },
    onError: (err) => toast.error("Erro ao remover: " + err.message)
  });

  const handleDownload = async (fileName: string) => {
    const filePath = `${profile?.company_id || 'shared'}/${fileName}`;
    const { data, error } = await supabase.storage.from('arquivos').download(filePath);
    if (error) {
      toast.error("Erro ao baixar: " + error.message);
      return;
    }
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      uploadMutation.mutate(file);
    }
  };

  return (
    <>
      <PageHeader
        title="Arquivos & Artes"
        description="Central de arquivos da sua gráfica"
        action={
          <>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange} 
            />
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Enviar arquivo
            </Button>
          </>
        }
      />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Arquivo</TableHead>
              <TableHead className="hidden md:table-cell">Tamanho</TableHead>
              <TableHead className="hidden md:table-cell">Data</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
               <TableRow><TableCell colSpan={4} className="text-center py-6"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
            ) : files?.length === 0 ? (
               <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                Nenhum arquivo no repositório. O bucket de Storage "arquivos" precisa estar configurado no Supabase.
               </TableCell></TableRow>
            ) : files?.map((f: any) => (
              <TableRow key={f.name}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileImage className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{f.name.split('_').slice(1).join('_') || f.name}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {(f.metadata?.size / 1024).toFixed(1)} KB
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {new Date(f.created_at).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleDownload(f.name)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(f.name)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
