import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Printer, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/dashboard" });
  }

  return <AuthShell>
    <div className="text-center mb-8">
      <h1 className="text-2xl font-bold tracking-tight">Entrar no PrintFlow</h1>
      <p className="text-sm text-muted-foreground mt-1">Acesse o painel da sua gráfica</p>
    </div>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@grafica.com" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Senha</Label>
          <Link to="/forgot-password" className="text-xs text-primary hover:underline">Esqueci minha senha</Link>
        </div>
        <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Entrar
      </Button>
    </form>
    <p className="text-center text-sm text-muted-foreground mt-6">
      Não tem conta? <Link to="/signup" className="text-primary font-medium hover:underline">Criar conta</Link>
    </p>
  </AuthShell>;
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative overflow-hidden p-12 flex-col justify-between text-white"
        style={{ background: "var(--gradient-brand)" }}>
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur">
            <Printer className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold">PrintFlow</div>
            <div className="text-[11px] uppercase tracking-wider opacity-80">CRM</div>
          </div>
        </div>
        <div className="relative z-10">
          <h2 className="text-4xl font-bold leading-tight max-w-md">
            O sistema premium para gráficas modernas.
          </h2>
          <p className="mt-4 text-white/80 max-w-md">
            Orçamentos, clientes, pedidos, produção e financeiro num só lugar.
            Pensado para DTF, sublimação, offset e comunicação visual.
          </p>
          <div className="mt-8 flex gap-6 text-sm">
            <div><div className="text-2xl font-bold">+50%</div><div className="text-white/70">Mais orçamentos</div></div>
            <div><div className="text-2xl font-bold">2x</div><div className="text-white/70">Velocidade</div></div>
            <div><div className="text-2xl font-bold">100%</div><div className="text-white/70">Controle</div></div>
          </div>
        </div>
        <div className="text-xs text-white/60">© PrintFlow CRM</div>
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-black/20 blur-3xl" />
      </div>
      <div className="flex items-center justify-center p-6 md:p-12 bg-background">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
