import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/status-badge";
import { 
  Settings, Save, Key, ShieldCheck, Sparkles, 
  RefreshCw, Loader2, CheckCircle2, XCircle, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Definição das plataformas suportadas
const PLATFORMS = [
  { key: "mercado_livre", label: "Mercado Livre", hasSecret: true, secretLabel: "Refresh Token", extraFields: [] },
  { key: "shopee", label: "Shopee API", hasSecret: true, secretLabel: "Partner Key", extraFields: [] },
  { key: "nuvemshop", label: "Nuvemshop Token", hasSecret: false, secretLabel: "", extraFields: [] },
  { key: "woocommerce", label: "WooCommerce", hasSecret: true, secretLabel: "Consumer Secret", extraFields: [
    { key: "store_url", label: "URL da Loja WooCommerce", placeholder: "https://minhagrafica.com.br" }
  ]},
] as const;

type PlatformKey = typeof PLATFORMS[number]["key"];

interface CredentialRow {
  id: string;
  company_id: string;
  platform: string;
  credential_key: string;
  credential_secret: string | null;
  extra_config: Record<string, string>;
  status: string;
  last_verified_at: string | null;
  error_message: string | null;
}

// Estado local para edição de cada plataforma
interface PlatformForm {
  key: string;
  secret: string;
  extraConfig: Record<string, string>;
  dirty: boolean; // se teve alteração local não salva
}

export function ConfiguracoesHub() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Preferências locais (localStorage)
  const [globalMargin, setGlobalMargin] = useState(50);
  const [aiTone, setAiTone] = useState("persuasivo");
  const [enableAutoUpdate, setEnableAutoUpdate] = useState(true);

  // Formulários locais de credenciais por plataforma
  const [forms, setForms] = useState<Record<PlatformKey, PlatformForm>>(() => {
    const initial: Record<string, PlatformForm> = {};
    PLATFORMS.forEach(p => {
      initial[p.key] = { key: "", secret: "", extraConfig: {}, dirty: false };
    });
    return initial as Record<PlatformKey, PlatformForm>;
  });

  // Carrega preferências do localStorage
  useEffect(() => {
    const savedMargin = localStorage.getItem("hub_global_margin");
    const savedTone = localStorage.getItem("hub_ai_tone");
    const savedAuto = localStorage.getItem("hub_auto_update");
    
    if (savedMargin) setGlobalMargin(parseInt(savedMargin));
    if (savedTone) setAiTone(savedTone);
    if (savedAuto) setEnableAutoUpdate(savedAuto === "true");
  }, []);

  // ─── Query: Buscar credenciais do Supabase ────────────────────────────
  const { data: credentials = [], isLoading: credentialsLoading } = useQuery({
    queryKey: ["marketplace_credentials", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("marketplace_credentials")
        .select("*")
        .eq("company_id", profile.company_id);
      if (error) throw error;
      return (data || []) as CredentialRow[];
    },
    enabled: !!profile?.company_id,
  });

  // Quando credenciais carregam, popular os formulários
  useEffect(() => {
    if (credentials.length > 0) {
      setForms(prev => {
        const updated = { ...prev };
        credentials.forEach(cred => {
          const platformKey = cred.platform as PlatformKey;
          if (updated[platformKey]) {
            updated[platformKey] = {
              key: cred.credential_key || "",
              secret: cred.credential_secret || "",
              extraConfig: (cred.extra_config || {}) as Record<string, string>,
              dirty: false,
            };
          }
        });
        return updated;
      });
    }
  }, [credentials]);

  // ─── Mutation: Salvar/Atualizar credencial (upsert) ──────────────────
  const saveMutation = useMutation({
    mutationFn: async (platform: PlatformKey) => {
      if (!profile?.company_id) throw new Error("Empresa não encontrada");
      const form = forms[platform];

      // Verifica se já existe
      const existing = credentials.find(c => c.platform === platform);

      if (existing) {
        // Update
        const { error } = await supabase
          .from("marketplace_credentials")
          .update({
            credential_key: form.key,
            credential_secret: form.secret || null,
            extra_config: form.extraConfig,
            status: form.key ? "connected" : "pending",
            error_message: null,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("marketplace_credentials")
          .insert({
            company_id: profile.company_id,
            platform,
            credential_key: form.key,
            credential_secret: form.secret || null,
            extra_config: form.extraConfig,
            status: form.key ? "connected" : "pending",
          });
        if (error) throw error;
      }
    },
    onSuccess: (_data, platform) => {
      toast.success(`Credenciais do ${PLATFORMS.find(p => p.key === platform)?.label} salvas com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["marketplace_credentials"] });
      // Marca como não-dirty
      setForms(prev => ({
        ...prev,
        [platform]: { ...prev[platform], dirty: false },
      }));
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar credencial: ${err.message}`);
    },
  });

  // ─── Mutation: Desconectar (deletar credencial) ──────────────────────
  const disconnectMutation = useMutation({
    mutationFn: async (platform: PlatformKey) => {
      const existing = credentials.find(c => c.platform === platform);
      if (!existing) return;
      const { error } = await supabase
        .from("marketplace_credentials")
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: (_data, platform) => {
      toast.success(`${PLATFORMS.find(p => p.key === platform)?.label} desconectado.`);
      queryClient.invalidateQueries({ queryKey: ["marketplace_credentials"] });
      // Limpa o form
      setForms(prev => ({
        ...prev,
        [platform]: { key: "", secret: "", extraConfig: {}, dirty: false },
      }));
    },
    onError: (err: any) => {
      toast.error(`Erro ao desconectar: ${err.message}`);
    },
  });

  // ─── Handlers ─────────────────────────────────────────────────────────
  const updateForm = (platform: PlatformKey, field: "key" | "secret", value: string) => {
    setForms(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value, dirty: true },
    }));
  };

  const updateExtraConfig = (platform: PlatformKey, configKey: string, value: string) => {
    setForms(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        extraConfig: { ...prev[platform].extraConfig, [configKey]: value },
        dirty: true,
      },
    }));
  };

  const getCredentialStatus = (platform: PlatformKey): { variant: "success" | "warning" | "destructive" | "muted"; label: string } => {
    const cred = credentials.find(c => c.platform === platform);
    if (!cred) return { variant: "muted", label: "Não configurado" };
    switch (cred.status) {
      case "connected": return { variant: "success", label: "Conectado" };
      case "expired": return { variant: "destructive", label: "Expirado" };
      case "error": return { variant: "destructive", label: "Erro" };
      default: return { variant: "warning", label: "Pendente" };
    }
  };

  const handleSavePreferences = () => {
    localStorage.setItem("hub_global_margin", globalMargin.toString());
    localStorage.setItem("hub_ai_tone", aiTone);
    localStorage.setItem("hub_auto_update", enableAutoUpdate.toString());
    
    toast.success("Configurações do Hub salvas com sucesso!");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* PREFERÊNCIAS GLOBAIS */}
      <Card className="md:col-span-2 border-t-4 border-slate-500">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-slate-500" />
            Preferências Globais do Hub
          </CardTitle>
          <CardDescription>
            Defina comportamentos automáticos e regras financeiras padrões para as importações de fornecedores.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="global-margin">Margem de Lucro Padrão (%)</Label>
              <Input 
                id="global-margin" 
                type="number" 
                value={globalMargin}
                onChange={(e) => setGlobalMargin(parseInt(e.target.value) || 0)}
              />
              <p className="text-[10px] text-muted-foreground">Aplicado a novos produtos importados caso o fornecedor não tenha margem própria.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-tone">Tom de Voz da IA para Copys</Label>
              <select
                id="ai-tone"
                value={aiTone}
                onChange={(e) => setAiTone(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="persuasivo">Persuasivo e Comercial (Foco em Vendas)</option>
                <option value="tecnico">Técnico e Preciso (Foco em Especificações)</option>
                <option value="descontraido">Descontraído e Moderno</option>
                <option value="formal">Formal e Corporativo</option>
              </select>
              <p className="text-[10px] text-muted-foreground">Define o estilo dos copys gerados para Mercado Livre e Shopee.</p>
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-warning-foreground" /> Automotização & Sincronia
            </h4>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border">
              <div className="space-y-0.5">
                <Label htmlFor="auto-update" className="text-sm font-semibold">Atualização Automática de Preços</Label>
                <p className="text-xs text-muted-foreground max-w-md">Alertar o gestor caso o custo no site do fornecedor sofra alterações após reanálise.</p>
              </div>
              <Switch 
                id="auto-update"
                checked={enableAutoUpdate}
                onCheckedChange={setEnableAutoUpdate}
              />
            </div>
          </div>

          <Button onClick={handleSavePreferences} className="bg-slate-700 hover:bg-slate-800 text-white flex items-center gap-1.5 self-end">
            <Save className="h-4 w-4" /> Salvar Preferências
          </Button>
        </CardContent>
      </Card>

      {/* INTEGRAÇÕES E CHAVES API — AGORA COM CRUD REAL */}
      <Card className="md:col-span-1 border-t-4 border-slate-500">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5 text-slate-500" />
            Tokens & Credenciais
          </CardTitle>
          <CardDescription>
            Conecte suas contas de marketplaces para sincronizar anúncios.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {credentialsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {PLATFORMS.map((platform) => {
                const status = getCredentialStatus(platform.key);
                const form = forms[platform.key];
                const cred = credentials.find(c => c.platform === platform.key);
                const isConnected = cred?.status === "connected";
                const isSaving = saveMutation.isPending;
                const isDisconnecting = disconnectMutation.isPending;

                return (
                  <div key={platform.key} className="space-y-2 pb-3 border-b last:border-b-0 last:pb-0">
                    {/* Header da plataforma */}
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-semibold">{platform.label}</Label>
                      <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                    </div>

                    {/* Campo principal: API Key / Token */}
                    <Input
                      type="password"
                      placeholder={`Token / API Key do ${platform.label}...`}
                      value={form.key}
                      onChange={(e) => updateForm(platform.key, "key", e.target.value)}
                      className="h-9 text-xs"
                    />

                    {/* Campo secret (quando aplicável) */}
                    {platform.hasSecret && (
                      <Input
                        type="password"
                        placeholder={platform.secretLabel}
                        value={form.secret}
                        onChange={(e) => updateForm(platform.key, "secret", e.target.value)}
                        className="h-9 text-xs"
                      />
                    )}

                    {/* Campos extras (ex: URL para WooCommerce) */}
                    {platform.extraFields.map((field) => (
                      <Input
                        key={field.key}
                        placeholder={field.placeholder}
                        value={form.extraConfig[field.key] || ""}
                        onChange={(e) => updateExtraConfig(platform.key, field.key, e.target.value)}
                        className="h-9 text-xs"
                      />
                    ))}

                    {/* Mensagem de erro */}
                    {cred?.error_message && (
                      <p className="text-[10px] text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {cred.error_message}
                      </p>
                    )}

                    {/* Botões de ação */}
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant={isConnected && !form.dirty ? "outline" : "default"}
                        className="h-7 text-[10px] flex-1"
                        disabled={!form.key || isSaving}
                        onClick={() => saveMutation.mutate(platform.key)}
                      >
                        {isSaving ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : isConnected && !form.dirty ? (
                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                        ) : (
                          <Save className="h-3 w-3 mr-1" />
                        )}
                        {isConnected && !form.dirty ? "Salvo" : "Salvar"}
                      </Button>

                      {isConnected && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={isDisconnecting}
                          onClick={() => {
                            if (window.confirm(`Deseja desconectar o ${platform.label}? Os dados de credencial serão removidos.`)) {
                              disconnectMutation.mutate(platform.key);
                            }
                          }}
                        >
                          {isDisconnecting ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          Desconectar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t pt-4 p-3 bg-slate-500/5 rounded border flex gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
            <p className="text-[10px] text-muted-foreground">
              Suas credenciais são armazenadas com segurança no Supabase, protegidas por Row Level Security. Cada empresa acessa apenas suas próprias credenciais.
            </p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
