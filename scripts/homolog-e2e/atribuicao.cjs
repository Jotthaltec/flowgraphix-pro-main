// Jornada de atribuição e sinais de conversão na homologação local.
//
//   anúncio (UTM + IDs + fbclid) -> aviso de cookies -> aceitar -> cadastro ->
//   pedido -> pagamento no admin -> atribuição -> fila da Conversions API ->
//   origem no CRM; orçamento pelo site -> Lead com o mesmo event_id do Pixel
//
// O Pixel real é trocado por um stub que só registra as chamadas (nada sai
// para a Meta); qualquer requisição a domínios da Meta é bloqueada e contada.
// Pré-requisitos: os do README + sinais ligados em modo teste no banco local:
//   store.set_marketing_signal_settings(true, 'test', '123456789012345', 'TESTLOCAL1')
//
//   node atribuicao.cjs
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");

const SITE = process.env.HOMOLOG_SITE || "http://localhost:3001";
const CRM = process.env.HOMOLOG_CRM || "http://localhost:8080";
const DB_CONTAINER = process.env.HOMOLOG_DB || "supabase_db_gkbbzypdakjrvxwvfjlc";
const DONO = { email: "dono@homolog.local", senha: "Homolog#2026" };
const SENHA = "Homolog#2026";
const PIXEL = "123456789012345";
const SHOTS = __dirname + "/shots";
require("fs").mkdirSync(SHOTS, { recursive: true });

if (!/gkbbzypdakjrvxwvfjlc$/.test(DB_CONTAINER)) {
  console.error("Container de banco inesperado; esta jornada só roda na homologação da Nexus.");
  process.exit(1);
}

const sql = (q) =>
  execFileSync("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-tA", "-F", "|", "-c", q], {
    encoding: "utf8",
  }).trim();
const one = (q) => sql(q).split("\n")[0] ?? "";

const results = [];
async function etapa(nome, fn) {
  const t0 = Date.now();
  try {
    const detalhe = await fn();
    results.push({ nome, ok: true });
    console.log(`✔ ${nome} (${Math.round((Date.now() - t0) / 1000)} s)${detalhe ? ` — ${detalhe}` : ""}`);
  } catch (e) {
    results.push({ nome, ok: false });
    console.log(`✘ ${nome} — ${e.message.split("\n")[0]}`);
    throw e;
  }
}
function confere(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function ate(fn, { segundos = 30, msg }) {
  const fim = Date.now() + segundos * 1000;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > fim) throw new Error(msg);
    await new Promise((r) => setTimeout(r, 1000));
  }
}
function cpfValido() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (base) => {
    const s = base.reduce((acc, d, i) => acc + d * (base.length + 1 - i), 0);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  n.push(dv(n));
  n.push(dv(n));
  const c = n.join("");
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

// Stub do fbevents.js: registra as chamadas e cria _fbp/_fbc como o Pixel real faz.
const PIXEL_STUB = `
(function () {
  var f = window.fbq; window.__pixel = window.__pixel || [];
  var keep = function (a) { window.__pixel.push(JSON.parse(JSON.stringify(Array.prototype.slice.call(a)))); };
  (f.queue || []).forEach(keep); f.queue = [];
  f.callMethod = function () { keep(arguments); };
  var now = Date.now();
  if (!/(^|; )_fbp=/.test(document.cookie)) document.cookie = "_fbp=fb.1." + now + ".1234567890; path=/";
  var m = location.search.match(/[?&]fbclid=([^&]+)/);
  if (m) document.cookie = "_fbc=fb.1." + now + "." + m[1] + "; path=/";
})();`;

let chamadasMeta = 0;
async function contexto(browser, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...extra });
  // Um só manipulador, decidido pelo host (não pelo texto da URL: a própria
  // página tem utm_source=facebook na query).
  const meta = (url) => /(^|\.)(facebook\.com|facebook\.net|fbcdn\.net)$/.test(url.hostname);
  await ctx.route(meta, (r) => {
    if (r.request().url().includes("/fbevents.js")) {
      return r.fulfill({ status: 200, contentType: "application/javascript", body: PIXEL_STUB });
    }
    chamadasMeta++;
    return r.abort();
  });
  return ctx;
}
const pixel = (p) => p.evaluate(() => window.__pixel || []);
const cookie = async (ctx, name) => (await ctx.cookies()).find((c) => c.name === name)?.value;

(async () => {
  const browser = await chromium.launch();
  const stamp = Date.now();
  const campanha = `qa-atribuicao-${stamp}`;
  const fbclid = `IwAR-qa-${stamp}`;
  const slug = one("select slug from store.products where active and archived_at is null and unpublished_at is null order by created_at limit 1");
  confere(slug, "homologação sem produto ativo");
  confere(one("select store.public_tracking_config() ->> 'pixel_id'") === PIXEL, "sinais não ligados no banco local (ver cabeçalho)");
  const email = `qa.atribuicao.${stamp}@homolog.local`;

  try {
    const ctx = await contexto(browser);
    const p = await ctx.newPage();
    let sid;
    let pedido;

    await etapa("1. Chegada pelo anúncio grava sessão e ponto de contato (sem consentimento)", async () => {
      const url = `${SITE}/produtos/${slug}?utm_source=facebook&utm_medium=paid_social&utm_campaign=${campanha}` +
        `&utm_content=reel-qa&utm_id=120200000000001&nx_adset=120200000000002&nx_ad=120200000000003&fbclid=${fbclid}`;
      await p.goto(url, { waitUntil: "networkidle" });
      sid = await cookie(ctx, "nx_sid");
      confere(sid, "cookie nx_sid não criado");
      const [canal, camp, ad, fb] = sql(
        `select channel, utm_campaign, meta_ad_id, coalesce(fbclid,'∅') from store.marketing_touchpoints where session_id = '${sid}'`,
      ).split("|");
      confere(canal === "paid_social" && camp === campanha && ad === "120200000000003", `ponto de contato: ${canal}/${camp}/${ad}`);
      confere(fb === "∅", "fbclid guardado sem consentimento");
      confere((await pixel(p)).length === 0, "Pixel carregou antes do consentimento");
      return `sessão ${sid.slice(0, 8)}…`;
    });

    await etapa("2. Aviso de cookies: aceitar carrega o Pixel e registra o consentimento no servidor", async () => {
      await p.getByRole("dialog", { name: "Cookies e anúncios" }).waitFor({ timeout: 15000 });
      await p.screenshot({ path: `${SHOTS}/atribuicao-aviso.png` });
      await p.getByRole("button", { name: "Aceitar" }).click();
      await ate(async () => (await pixel(p)).some((c) => c[0] === "track" && c[1] === "ViewContent"), {
        msg: "ViewContent não disparou após aceitar",
      });
      const chamadas = await pixel(p);
      confere(chamadas.some((c) => c[0] === "init" && c[1] === PIXEL), "Pixel iniciado com outro id");
      confere(chamadas.some((c) => c[0] === "track" && c[1] === "PageView"), "PageView ausente");
      await ate(() => one(`select ads_consent from store.marketing_sessions where id = '${sid}'`) === "t", {
        msg: "consentimento não chegou ao servidor",
      });
      const [fbc, fbp, ua] = sql(
        `select coalesce(t.fbc,'∅'), coalesce(t.fbp,'∅'), coalesce(s.client_user_agent,'∅') from store.marketing_touchpoints t join store.marketing_sessions s on s.id = t.session_id where t.session_id = '${sid}'`,
      ).split("|");
      confere(fbc.endsWith(fbclid) && fbp.startsWith("fb.1.") && ua !== "∅", `identificadores: ${fbc} / ${fbp}`);
      return "fbc, fbp e user agent guardados depois do aceite";
    });

    await etapa("3. Cadastro e pedido no site ficam ligados à sessão", async () => {
      await p.goto(`${SITE}/cadastro`, { waitUntil: "networkidle" });
      await p.fill('input[name="full_name"]', "QA Atribuição");
      await p.fill('input[name="document"]', cpfValido());
      await p.fill('input[name="phone"]', "(11) 90000-0000");
      await p.fill('input[name="email"]', email);
      await p.fill('input[name="password"]', SENHA);
      await p.fill('input[name="password_confirm"]', SENHA);
      await p.click('button[role="checkbox"]');
      await Promise.all([p.waitForURL(/\/painel/, { timeout: 60000 }), p.click('button:has-text("Criar conta")')]);
      await p.goto(`${SITE}/produtos/${slug}`, { waitUntil: "networkidle" });
      await p.click('button:has-text("Adicionar ao carrinho")');
      await p.waitForTimeout(2000);
      await p.goto(`${SITE}/checkout`, { waitUntil: "networkidle" });
      await ate(async () => (await pixel(p)).some((c) => c[1] === "InitiateCheckout"), { msg: "InitiateCheckout não disparou" });
      await p.waitForFunction(() => !document.body.innerText.includes("Atualizando valores"), null, { timeout: 30000 });
      await Promise.all([
        p.waitForURL(/\/pedido\/.+\/confirmado/, { timeout: 60000 }),
        p.click('button:has-text("Confirmar pedido")'),
      ]);
      pedido = p.url().match(/pedido\/([0-9a-f-]+)\/confirmado/)[1];
      confere(
        one(`select session_id from store.marketing_session_links where subject_type = 'order' and subject_id = '${pedido}'`) === sid,
        "pedido não ligado à sessão do anúncio",
      );
      confere(one(`select count(*) from store.order_attributions where order_id = '${pedido}'`) === "0", "pendente já atribuído");
      confere(one(`select count(*) from store.conversion_events where order_id = '${pedido}'`) === "0", "Purchase de pedido pendente");
      confere(!(await pixel(p)).some((c) => c[1] === "Purchase"), "navegador disparou Purchase de pedido não pago");
      return one(`select number from store.orders where id = '${pedido}'`);
    });

    await etapa("4. Pagamento confirmado no admin: atribuição e Purchase na fila, uma vez só", async () => {
      const adminCtx = await contexto(browser, { storageState: undefined });
      const admin = await adminCtx.newPage();
      await admin.goto(`${SITE}/entrar`, { waitUntil: "networkidle" });
      await admin.fill('input[type="email"]', DONO.email);
      await admin.fill('input[type="password"]', DONO.senha);
      await Promise.all([admin.waitForURL((u) => !u.pathname.startsWith("/entrar")), admin.click('button[type="submit"]')]);
      admin.once("dialog", (d) => d.accept("Pix recebido (jornada de atribuição)"));
      await admin.goto(`${SITE}/admin/pedidos/${pedido}`, { waitUntil: "networkidle" });
      await admin.click('button:has-text("Confirmar pagamento manualmente")');
      await ate(() => one(`select payment_status from store.orders where id = '${pedido}'`) === "pago", { msg: "pagamento não confirmado" });

      const [canal, camp, ad, receita, total] = sql(
        `select a.channel, a.utm_campaign, a.meta_ad_id, a.revenue, o.total + o.credit_used from store.order_attributions a join store.orders o on o.id = a.order_id where a.order_id = '${pedido}' and a.is_primary`,
      ).split("|");
      confere(canal === "paid_social" && camp === campanha && ad === "120200000000003", `atribuição: ${canal}/${camp}/${ad}`);
      confere(Number(receita) === Number(total), `receita ${receita} ≠ pedido ${total}`);

      const ev = JSON.parse(one(`select json_build_object('status', status, 'id', event_id, 'p', payload) from store.conversion_events where order_id = '${pedido}'`));
      confere(ev.status === "pending" && ev.id === `purchase:${pedido}`, `evento ${ev.status} ${ev.id}`);
      confere(ev.p.user_data.fbc.endsWith(fbclid) && ev.p.user_data.fbp && ev.p.user_data.client_user_agent, "evento sem fbc/fbp/UA");
      confere(Number(ev.p.custom_data.value) === Number(total), "valor do evento diferente do pedido");
      confere(!JSON.stringify(ev.p).includes(email), "e-mail em texto puro no evento");

      sql(`update store.orders set payment_status = 'pago' where id = '${pedido}'`);
      confere(one(`select count(*) from store.conversion_events where event_id = 'purchase:${pedido}'`) === "1", "Purchase duplicado");
      confere(one(`select count(*) from store.order_attributions where order_id = '${pedido}'`) === "2", "atribuição duplicada");
      await adminCtx.close();
      return `${camp} · R$ ${receita}`;
    });

    await etapa("5. CRM mostra a origem do pedido", async () => {
      const crmCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const crm = await crmCtx.newPage();
      await crm.goto(`${CRM}/login`, { waitUntil: "networkidle" });
      await crm.fill('input[type="email"]', DONO.email);
      await crm.fill('input[type="password"]', DONO.senha);
      await Promise.all([crm.waitForURL((u) => !u.pathname.startsWith("/login")), crm.click('button:has-text("Entrar")')]);
      await crm.goto(`${CRM}/pedidos`, { waitUntil: "networkidle" });
      const numero = one(`select number from store.orders where id = '${pedido}'`);
      const linha = crm.locator("tr", { hasText: numero });
      await linha.waitFor({ timeout: 20000 });
      const texto = await linha.innerText();
      await crm.screenshot({ path: `${SHOTS}/atribuicao-crm-pedidos.png`, fullPage: true });
      confere(texto.includes("Anúncio (redes)") && texto.includes(campanha), `linha do pedido sem origem: ${texto.replace(/\s+/g, " ")}`);
      await crmCtx.close();
      return `${numero}: Anúncio (redes) · ${campanha}`;
    });

    await etapa("6. Orçamento pelo site: Lead no Pixel e na fila com o mesmo event_id", async () => {
      const lctx = await contexto(browser);
      await lctx.addCookies([{ name: "nx_consent", value: "ads", url: SITE }]);
      const lp = await lctx.newPage();
      await lp.goto(`${SITE}/orcamento?utm_source=instagram&utm_medium=paid_social&utm_campaign=${campanha}-lead`, {
        waitUntil: "networkidle",
      });
      await lp.fill("#name", "QA Lead Atribuição");
      await lp.fill("#email", `qa.lead.${stamp}@homolog.local`);
      await lp.fill("#phone", "(11) 91234-5678");
      await lp.fill("#product", "Cartão de visita");
      await lp.fill("#message", "Orçamento de teste da jornada de atribuição.");
      await lp.getByRole("button", { name: "Enviar solicitação" }).click();
      await lp.getByText("Solicitação recebida!").waitFor({ timeout: 30000 });
      const lead = await ate(async () => (await pixel(lp)).find((c) => c[0] === "track" && c[1] === "Lead"), {
        msg: "Lead não disparou no navegador",
      });
      const eventId = lead[3]?.eventID;
      confere(/^lead:[0-9a-f-]{36}$/.test(eventId || ""), `eventID do Pixel: ${eventId}`);
      const [status, canal] = sql(
        `select e.status, a.channel from store.conversion_events e left join store.marketing_session_links l on l.subject_id = e.quote_id
           left join store.marketing_touchpoints a on a.session_id = l.session_id where e.event_id = '${eventId}'`,
      ).split("|");
      confere(status === "pending", `Lead na fila: ${status || "ausente"}`);
      confere(canal === "paid_social", `origem do orçamento: ${canal}`);
      await lctx.close();
      return `${eventId.slice(0, 13)}… no navegador e no servidor`;
    });

    await etapa("7. Nada saiu para a Meta e o worker segue desligado sem token", async () => {
      confere(chamadasMeta === 0, `${chamadasMeta} requisição(ões) para domínios da Meta`);
      const r = await fetch(`${CRM}/api/marketing/conversions`, { method: "POST" });
      confere(r.status === 401, `worker sem segredo respondeu ${r.status}`);
      confere(one("select store.meta_capi_config() ->> 'enabled'") === "false", "worker habilitado sem token");
      return "0 chamadas externas; rota protegida (401)";
    });
  } finally {
    await browser.close();
    const ok = results.filter((r) => r.ok).length;
    console.log(`\n${ok}/${results.length} etapas ok`);
    process.exit(results.every((r) => r.ok) && results.length === 7 ? 0 : 1);
  }
})();
