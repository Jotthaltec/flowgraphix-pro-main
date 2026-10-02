import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, Loader2, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { MetaCheck } from "@/services/meta/verify";

function Line({ ok, title, text }: { ok: boolean; title: string; text: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      ) : (
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      )}
      <span>
        {title}
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
    </li>
  );
}

/** Confere na Meta, pelo servidor, se o Pixel salvo existe e quando o token vence. */
export function MetaConnectionCheck() {
  const check = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch("/api/marketing/verify-meta", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.session?.access_token ?? ""}` },
      });
      const body = (await res.json().catch(() => null)) as {
        data?: MetaCheck;
        error?: { message: string };
      } | null;
      if (!res.ok || !body?.data)
        throw new Error(body?.error?.message ?? "Verificação indisponível.");
      return body.data;
    },
  });

  const r = check.data;
  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Conexão com a Meta</h2>
        <Button
          variant="outline"
          size="sm"
          disabled={check.isPending}
          onClick={() => check.mutate()}
        >
          {check.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <PlugZap className="mr-1 h-4 w-4" />
          )}
          Verificar conexão com a Meta
        </Button>
      </div>
      {check.error ? <p className="text-sm text-destructive">{check.error.message}</p> : null}
      {r ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          <Line
            ok={r.pixel.ok}
            title={
              r.pixel.ok
                ? `Pixel: ${r.pixel.name ?? "sem nome"}${r.pixel.business ? ` (${r.pixel.business})` : ""}`
                : "Pixel"
            }
            text={r.pixel.message}
          />
          <Line
            ok={r.token.ok}
            title={`Token${r.token.type ? ` (${r.token.type === "USER" ? "pessoal" : "usuário do sistema"})` : ""}`}
            text={
              r.token.message +
              (r.token.expiresAt
                ? ` Data: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(r.token.expiresAt))}.`
                : "")
            }
          />
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Confere se o ID salvo é mesmo de um Pixel acessível e mostra quando o token vence. O token
          nunca sai do servidor.
        </p>
      )}
    </Card>
  );
}
