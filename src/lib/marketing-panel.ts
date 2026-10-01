/**
 * Regras de exibição do painel "Anúncios e Crescimento". Puras e testadas:
 * a tela só mostra número quando ele existe; o que falta aparece com o motivo.
 */

export type PeriodPreset = "hoje" | "7d" | "30d" | "90d";

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
};

/** Dia civil em America/Sao_Paulo (o banco agrega no mesmo fuso). */
export function saoPauloDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function shiftCivil(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Intervalo inclusivo [from, to] terminando hoje. */
export function periodRange(preset: PeriodPreset, now: Date = new Date()) {
  const to = saoPauloDate(now);
  const days = { hoje: 1, "7d": 7, "30d": 30, "90d": 90 }[preset];
  return { from: shiftCivil(to, -(days - 1)), to };
}

/** Proporção ou null quando o denominador é zero (nunca "0%" inventado). */
export function rate(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

export type Metric = { value: number | null; reason: string | null };

/** ROAS de receita: só com investimento importado da Meta. */
export function revenueRoas(
  revenue: number,
  spend: number | null,
  spendReason: string | null,
): Metric {
  if (spend === null) return { value: null, reason: spendReason ?? "Investimento indisponível." };
  if (spend <= 0) return { value: null, reason: "Sem investimento no período." };
  return { value: revenue / spend, reason: null };
}

export type SignalStatus = {
  settings: {
    enabled: boolean;
    mode: "test" | "live";
    pixel_id: string | null;
    test_event_code: string | null;
    graph_api_version: string;
    version: number;
    updated_at: string;
  } | null;
  token_configured: boolean;
  dispatch_configured: boolean;
  cron_active: boolean;
  queue: Record<string, number>;
  oldest_pending_at: string | null;
  last_sent_at: string | null;
  last_failure: {
    at: string;
    code: string | null;
    message: string | null;
    http: number | null;
  } | null;
};

export type SignalCheck = { label: string; ok: boolean; hint: string };

export type SignalHealth = {
  state: "desligado" | "incompleto" | "teste" | "real";
  title: string;
  checks: SignalCheck[];
  /** Eventos esperando há mais de 30 min com tudo configurado = algo travado. */
  stalled: boolean;
};

export function signalHealth(status: SignalStatus, now: Date = new Date()): SignalHealth {
  const s = status.settings;
  const checks: SignalCheck[] = [
    {
      label: "Pixel informado",
      ok: Boolean(s?.pixel_id),
      hint: "ID do conjunto de dados (Pixel) no Gerenciador de Eventos.",
    },
    {
      label: "Código de teste (modo teste)",
      ok: s?.mode === "live" || Boolean(s?.test_event_code),
      hint: "Sem ele, o modo teste mandaria eventos como reais; o envio fica bloqueado.",
    },
    {
      label: "Token da Conversions API no Vault",
      ok: status.token_configured,
      hint: "Segredo 'meta_capi_access_token' (usuário do sistema). Nunca é exibido aqui.",
    },
    {
      label: "Despacho configurado",
      ok: status.dispatch_configured,
      hint: "Segredos 'marketing_dispatch_url' e 'marketing_dispatch_secret' + MARKETING_DISPATCH_SECRET no CRM.",
    },
    {
      label: "Agendamento ativo",
      ok: status.cron_active,
      hint: "Job 'store-conversion-events-dispatch' no pg_cron.",
    },
  ];
  const ready = checks.every((c) => c.ok);
  const oldest = status.oldest_pending_at ? new Date(status.oldest_pending_at).getTime() : null;
  const stalled = Boolean(
    s?.enabled && ready && oldest !== null && now.getTime() - oldest > 30 * 60_000,
  );

  if (!s?.enabled) {
    return {
      state: "desligado",
      title: "Desligado: nenhum Pixel na loja e nada enviado à Meta.",
      checks,
      stalled: false,
    };
  }
  if (!ready) {
    return {
      state: "incompleto",
      title: "Ligado, mas o envio pelo servidor está parado até completar a configuração.",
      checks,
      stalled: false,
    };
  }
  return s.mode === "live"
    ? { state: "real", title: "Enviando eventos reais para a Meta.", checks, stalled }
    : {
        state: "teste",
        title: "Modo teste: eventos só aparecem em Testar eventos.",
        checks,
        stalled,
      };
}

export const EVENT_STATUS_LABELS: Record<string, string> = {
  pending: "Na fila",
  in_progress: "Enviando",
  sent: "Enviado",
  failed: "Falhou",
  skipped: "Não enviado",
  expired: "Expirado (7 dias)",
};

export const SKIP_REASON_LABELS: Record<string, string> = {
  sem_consentimento: "visitante não aceitou cookies de anúncio",
  sem_sessao: "pedido sem visita rastreada",
  pagamento_revertido: "pagamento estornado/cancelado antes do envio",
  consentimento_revogado: "visitante revogou o consentimento",
};
