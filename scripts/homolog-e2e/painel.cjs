// Painel "Anúncios e Crescimento" no CRM, na homologação local.
//
//   números da tela = banco -> correção manual pela interface (com auditoria)
//   -> diagnóstico dos sinais aponta o que falta -> "Desligar agora" tira o
//   Pixel da loja -> religar pelo formulário
//
// Pré-requisitos: os do README; rode depois de atribuicao.cjs (precisa de
// pedidos atribuídos). Deixa os sinais como encontrou.
//
//   node painel.cjs
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");

const CRM = process.env.HOMOLOG_CRM || "http://localhost:8080";
const DB_CONTAINER = process.env.HOMOLOG_DB || "supabase_db_gkbbzypdakjrvxwvfjlc";
const DONO = { email: "dono@homolog.local", senha: "Homolog#2026" };
const SHOTS = __dirname + "/shots";
require("fs").mkdirSync(SHOTS, { recursive: true });
if (!/gkbbzypdakjrvxwvfjlc$/.test(DB_CONTAINER)) {
  console.error("Container de banco inesperado; este roteiro só roda na homologação da Nexus.");
  process.exit(1);
}

const sql = (q) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-tA",
      "-F",
      "|",
      "-c",
      q,
    ],
    {
      encoding: "utf8",
    },
  ).trim();
const one = (q) => sql(q).split("\n")[0] ?? "";
// Funções do painel exigem o usuário: simula o dono numa transação de leitura.
const asOwner = (q) =>
  sql(
    `begin; select set_config('request.jwt.claim.sub', (select owner_id::text from public.companies where id = public.crm_default_company()), true); ${q}; commit;`,
  )
    .split("\n")
    .filter((l) => !/^(BEGIN|COMMIT)$/.test(l))
    .pop() ?? "";

const results = [];
async function etapa(nome, fn) {
  try {
    const detalhe = await fn();
    results.push(true);
    console.log(`✔ ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  } catch (e) {
    results.push(false);
    console.log(`✘ ${nome} — ${e.message.split("\n")[0]}`);
    throw e;
  }
}
const confere = (c, m) => {
  if (!c) throw new Error(m);
};
const brl = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(v)
    .replace(/\s/g, " ");
const norm = (s) => s.replace(/\s/g, " ");

(async () => {
  const antes = one(
    "select row_to_json(s) from store.marketing_signal_settings s where company_id = public.crm_default_company()",
  );
  const browser = await chromium.launch();
  const p = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  try {
    await p.goto(`${CRM}/login`, { waitUntil: "networkidle" });
    await p.fill('input[type="email"]', DONO.email);
    await p.fill('input[type="password"]', DONO.senha);
    await Promise.all([
      p.waitForURL((u) => !u.pathname.startsWith("/login")),
      p.click('button:has-text("Entrar")'),
    ]);

    await etapa("1. Menu leva ao painel e os números batem com o banco", async () => {
      await p.click('a:has-text("Anúncios e Crescimento")');
      await p.waitForURL(/\/anuncios/);
      await p.getByText("Receita atribuída a anúncios").waitFor({ timeout: 30000 });
      const hoje = one("select (now() at time zone 'America/Sao_Paulo')::date");
      const ov = JSON.parse(
        asOwner(`select store.marketing_overview('${hoje}'::date - 29, '${hoje}'::date)`),
      );
      const texto = norm(await p.locator("main").last().innerText());
      confere(
        texto.includes(brl(ov.revenue.ads)),
        `receita de anúncios ${brl(ov.revenue.ads)} não aparece`,
      );
      confere(
        texto.includes(`${ov.funnel.ad_paid_orders} pedido(s) pago(s) via anúncio`),
        "contagem de pagos via anúncio",
      );
      confere(
        /Investimento\s*Indisponível/.test(texto) && /ROAS de receita\s*Indisponível/.test(texto),
        "investimento/ROAS não marcados como indisponíveis",
      );
      await p.screenshot({ path: `${SHOTS}/painel-visao-geral.png`, fullPage: true });
      return `${brl(ov.revenue.ads)} em ${ov.funnel.ad_paid_orders} pedido(s) via anúncio (30 dias)`;
    });

    await etapa("2. Correção manual pela interface fica na auditoria com o usuário", async () => {
      const alvo = one(
        "select order_number from store.order_attributions where is_primary and status = 'active' and source = 'auto' and channel = 'paid_social' order by attributed_at desc limit 1",
      );
      confere(alvo, "sem pedido atribuído a anúncio (rode atribuicao.cjs antes)");
      await p.getByRole("tab", { name: "Pedidos atribuídos" }).click();
      await p.getByRole("button", { name: `Corrigir origem do pedido ${alvo}` }).click();
      await p
        .getByLabel("Motivo (obrigatório)")
        .fill("Teste do painel: cliente confirmou indicação");
      await p.getByRole("button", { name: "Salvar correção" }).click();
      await p.getByText(`Origem do pedido ${alvo} corrigida`).waitFor({ timeout: 15000 });
      const [canal, fonte] = sql(
        `select channel, source from store.order_attributions where order_number = '${alvo}' and is_primary`,
      ).split("|");
      confere(canal === "direct" && fonte === "manual", `atribuição ficou ${canal}/${fonte}`);
      const autor = one(
        `select u.email from store.marketing_attribution_audit a join auth.users u on u.id = a.actor
          where a.order_id = (select id from store.orders where number = '${alvo}') and a.action = 'manual_correction' order by a.id desc limit 1`,
      );
      confere(autor === DONO.email, `auditoria com autor ${autor || "vazio"}`);
      await p.getByText("(corrigida)").first().waitFor();
      return `${alvo} → direto, auditado por ${autor}`;
    });

    await etapa("3. Diagnóstico aponta exatamente o que falta para enviar", async () => {
      await p.getByRole("tab", { name: "Sinais e configurações" }).click();
      await p.getByText("Token da Conversions API no Vault").waitFor({ timeout: 15000 });
      const st = JSON.parse(asOwner("select store.marketing_signal_status()"));
      const texto = norm(await p.locator("main").last().innerText());
      confere(
        !st.token_configured && texto.includes("meta_capi_access_token"),
        "falta do token não explicada",
      );
      confere(
        texto.includes("Incompleto") || !st.settings?.enabled,
        "estado deveria ser Incompleto",
      );
      confere(
        !/EAA[A-Za-z0-9]{10}|sb_secret|eyJhbGci/.test(await p.content()),
        "segredo na página",
      );
      await p.screenshot({ path: `${SHOTS}/painel-sinais.png`, fullPage: true });
      return "token e despacho pendentes, sem expor segredo";
    });

    await etapa("4. Desligar agora tira o Pixel da loja; religar pelo formulário", async () => {
      await p.getByRole("button", { name: "Desligar agora" }).click();
      await p.getByText("Sinais desligados").waitFor({ timeout: 15000 });
      confere(
        one(
          "select enabled from store.marketing_signal_settings where company_id = public.crm_default_company()",
        ) === "f",
        "continua ligado",
      );
      confere(
        one("select coalesce(store.public_tracking_config() ->> 'pixel_id', '∅')") === "∅",
        "loja ainda recebe o Pixel",
      );
      await p.getByText("Desligado:").waitFor();
      await p.getByLabel("Código de teste do Gerenciador de Eventos").fill("TESTLOCAL1");
      await p.getByRole("switch").click();
      await p.getByRole("button", { name: "Salvar", exact: true }).click();
      await p.getByText("Configuração salva.").waitFor({ timeout: 15000 });
      confere(
        one("select store.public_tracking_config() ->> 'pixel_id'") === "123456789012345",
        "não religou",
      );
      const versoes = one(
        "select count(*) from store.marketing_attribution_audit where action = 'settings_changed' and created_at > now() - interval '5 minutes'",
      );
      confere(Number(versoes) >= 2, "mudanças de configuração sem auditoria");
      return "desligado e religado, ambos auditados";
    });
  } finally {
    await browser.close();
    // Devolve os sinais como estavam (homologação).
    if (antes) {
      const a = JSON.parse(antes);
      asOwner(
        `select store.set_marketing_signal_settings(${a.enabled}, '${a.mode}', '${a.pixel_id ?? ""}', '${a.test_event_code ?? ""}', '${a.graph_api_version}')`,
      );
    }
    const ok = results.filter(Boolean).length;
    console.log(`\n${ok}/${results.length} etapas ok`);
    process.exit(results.length === 4 && results.every(Boolean) ? 0 : 1);
  }
})();
