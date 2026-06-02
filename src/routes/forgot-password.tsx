import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AuthShell } from "./login";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao enviar link", { description: error.message });
      return;
    }
    toast.success("Link enviado! Verifique seu e-mail.");
  }

  return <AuthShell>
    <div className="text-center mb-8">
      <h1 className="text-2xl font-bold tracking-tight">Recuperar senha</h1>
      <p className="text-sm text-muted-foreground mt-1">Enviaremos um link para redefinir sua senha</p>
    </div>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Enviar link de recuperação
      </Button>
    </form>
    <p className="text-center text-sm text-muted-foreground mt-6">
      <Link to="/login" className="text-primary font-medium hover:underline">Voltar para login</Link>
    </p>
  </AuthShell>;
}
