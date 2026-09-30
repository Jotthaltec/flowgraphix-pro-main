// Jornada ponta a ponta automática na homologação local.
//
//   importar -> publicar -> atualizar preço (fila) -> ver no site -> cadastro ->
//   pedido (+ idempotência) -> CRM -> pagamento -> financeiro -> produção ->
//   painel do cliente -> cancelamento -> arquivar -> republicar
//
// Cada etapa age pela interface (navegador) e confere o banco. Sai com código
// 1 se alguma etapa falhar. Repetível: cria um cliente novo por execução e
// termina com o produto publicado.
//
// Pré-requisitos (ver README.md): stack local com a cópia (homolog-local.sh),
// CRM em :8080, site em HOMOLOG_SITE (padrão :3001), `npm i playwright@1.63.0`.
//
//   node jornada.js
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");

const SITE = process.env.HOMOLOG_SITE || "http://localhost:3001";
const CRM = process.env.HOMOLOG_CRM || "http://localhost:8080";
const API = "http://127.0.0.1:54321";
const DB_CONTAINER = process.env.HOMOLOG_DB || "supabase_db_gkbbzypdakjrvxwvfjlc";
const DONO = { email: "dono@homolog.local", senha: "Homolog#2026" };
const SENHA_CLIENTE = "Homolog#2026";
const SHOTS = __dirname + "/shots";
require("fs").mkdirSync(SHOTS, { recursive: true });

// ---------------------------------------------------------------- utilidades

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
const esc = (s) => s.replace(/'/g, "''");

const results = [];
async function etapa(nome, fn) {
  const t0 = Date.now();
  try {
    const detalhe = await fn();
    results.push({ nome, ok: true });
    console.log(
      `✔ ${nome} (${Math.round((Date.now() - t0) / 1000)} s)${detalhe ? ` — ${detalhe}` : ""}`,
    );
  } catch (e) {
    results.push({ nome, ok: false });
    console.log(`✘ ${nome} — ${e.message.split("\n")[0]}`);
    throw e; // as etapas dependem umas das outras
  }
}
function confere(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function ate(fn, { segundos = 150, msg }) {
  const fim = Date.now() + segundos * 1000;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > fim) throw new Error(msg);
    await new Promise((r) => setTimeout(r, 3000));
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

async function anonKey() {
  const env = execFileSync("npx", ["supabase", "status", "-o", "env"], {
    cwd: __dirname + "/../..",
    encoding: "utf8",
    shell: true,
  });
  return env.match(/^ANON_KEY="(.+)"$/m)[1];
}

// --------------------------------------------------------------- navegador

async function loginCRM(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(`${CRM}/login`, { waitUntil: "networkidle" });
  await p.fill('input[type="email"]', DONO.email);
  await p.fill('input[type="password"]', DONO.senha);
  await Promise.all([
    p.waitForURL((u) => !u.pathname.startsWith("/login")),
    p.click('button:has-text("Entrar")'),
  ]);
  return p;
}

async function loginAdminLoja(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(`${SITE}/entrar`, { waitUntil: "networkidle" });
  await p.fill('input[type="email"]', DONO.email);
  await p.fill('input[type="password"]', DONO.senha);
  await Promise.all([
    p.waitForURL((u) => !u.pathname.startsWith("/entrar")),
    p.click('button[type="submit"]'),
  ]);
  return p;
}

async function comprar(p, slug, { duploEnvio = false } = {}) {
  await p.goto(`${SITE}/produtos/${slug}`, { waitUntil: "networkidle" });
  await p.click('button:has-text("Adicionar ao carrinho")');
  await p.waitForTimeout(2000);
  await p.goto(`${SITE}/checkout`, { waitUntil: "networkidle" });
  // Total que o cliente vê ANTES de confirmar (prévia calculada no servidor).
  await p.waitForFunction(() => !document.body.innerText.includes("Atualizando valores"), null, {
    timeout: 30000,
  });
  const resumo = await p.locator('text="Total a pagar"').locator("xpath=..").innerText();
  const totalCheckout = resumo.match(/R\$\s?[\d.,]+/)[0];
  if (duploEnvio) {
    await p.evaluate(() => {
      const f = document.querySelector("form");
      f.requestSubmit();
      f.requestSubmit();
    });
    await p.waitForURL(/\/pedido\/.+\/confirmado/, { timeout: 60000 });
  } else {
    await Promise.all([
      p.waitForURL(/\/pedido\/.+\/confirmado/, { timeout: 60000 }),
      p.click('button:has-text("Confirmar pedido")'),
    ]);
  }
  await p.waitForLoadState("networkidle");
  const orderId = p.url().match(/pedido\/([0-9a-f-]+)\/confirmado/)[1];
  const total = (await p.locator("text=/^R\\$\\s?[\\d.,]+$/").last().textContent()).trim();
  return { orderId, total, totalCheckout };
}

const valor = (texto) => Number(texto.replace(/[^\d,]/g, "").replace(",", ".")).toFixed(2);

async function situacao(admin, orderId, status) {
  await admin.goto(`${SITE}/admin/pedidos/${orderId}`, { waitUntil: "networkidle" });
  await admin.selectOption("select#status", status);
  await admin.click('button:has-text("Salvar situação")');
  await admin.waitForTimeout(2500);
}

// ----------------------------------------------------------------- jornada

(async () => {
  const KEY = await anonKey();
  const browser = await chromium.launch();
  const produto = sql(
    "select p.id, p.source_url, s.slug from public.products p join store.products s on s.crm_id = p.id limit 1",
  ).split("|");
  confere(
    produto.length === 3,
    "homologação sem produto do Flow publicado: rode homolog-local.sh refresh",
  );
  const [crmId, fonte, slug] = produto;
  const storeId = one(`select id from store.products where crm_id = '${crmId}'`);
  const numero = (id) => one(`select number from store.orders where id = '${id}'`);

  try {
    const crm = await loginCRM(browser);

    await etapa("1. Importar do fornecedor e publicar na Nexus", async () => {
      const antes = one("select count(*) from public.products");
      await crm.goto(`${CRM}/produtos/importar`, { waitUntil: "networkidle" });
      await crm
        .getByPlaceholder(/futuraim|https/i)
        .first()
        .fill(fonte);
      await crm.click('button:has-text("Analisar")');
      await crm.waitForFunction(() => document.body.innerText.includes("Analisado"), null, {
        timeout: 300000,
      });
      await crm.click('button[aria-label="Destino dos produtos"]');
      await crm.click('[role="option"]:has-text("Salvar e publicar na Nexus")');
      crm.once("dialog", (d) => d.accept()); // "já existe: atualizar?"
      await crm.getByRole("button", { name: "Salvar e publicar na Nexus", exact: true }).click();
      await crm.waitForFunction(
        () =>
          /Publicado|publicação falhou|Erro/.test(document.body.innerText) &&
          !/Salvando|Publicando/.test(document.body.innerText),
        null,
        { timeout: 300000 },
      );
      const status = await crm
        .locator("text=/^(Publicado|Publicado com atenção|Salvo, publicação falhou|Erro)$/")
        .first()
        .textContent();
      confere(status.startsWith("Publicado"), `item ficou "${status}"`);
      confere(
        one("select count(*) from public.products") === antes,
        "importação duplicou o produto no Flow",
      );
      confere(
        one(`select count(*) from store.products where crm_id = '${crmId}'`) === "1",
        "duplicou na loja",
      );
      confere(
        one(`select active and archived_at is null from store.products where id = '${storeId}'`) ===
          "t",
        "produto não ficou à venda",
      );
      return status;
    });

    let novoTotal;
    await etapa("2. Alterar preço no Flow e a fila publicar sozinha", async () => {
      const auth = await fetch(`${API}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: DONO.email, password: DONO.senha }),
      }).then((r) => r.json());
      const h = {
        apikey: KEY,
        Authorization: `Bearer ${auth.access_token}`,
        "Content-Type": "application/json",
      };
      const [p] = await fetch(`${API}/rest/v1/products?id=eq.${crmId}&select=quantity_prices`, {
        headers: h,
      }).then((r) => r.json());
      const base = p.quantity_prices.find((r) => r.quantity === 50);
      novoTotal = Math.round((base.sellPrice + 2.91) * 100) / 100;
      const rows = p.quantity_prices.map((r) =>
        r.quantity === 50
          ? {
              ...r,
              sellPrice: novoTotal,
              unitSellPrice: Math.round((novoTotal / 50) * 10000) / 10000,
            }
          : r,
      );
      const res = await fetch(`${API}/rest/v1/products?id=eq.${crmId}`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ quantity_prices: rows }),
      });
      confere(res.ok, `PATCH ${res.status}`);
      confere(
        one(`select status from store.product_sync_state('${storeId}')`) === "stale",
        "produto não ficou desatualizado",
      );
      await ate(
        () =>
          one(
            `select t.total_price from store.product_variant_price_tiers t join store.product_variants v on v.id = t.variant_id where v.product_id = '${storeId}' and v.is_default and t.quantity = 50`,
          ) === novoTotal.toFixed(2),
        { segundos: 150, msg: "a fila não publicou o preço novo em 150 s" },
      );
      confere(
        one(`select status from store.product_sync_state('${storeId}')`) === "synced",
        "não voltou a sincronizado",
      );
      return `R$ ${novoTotal.toFixed(2)} publicado pela fila`;
    });

    await etapa("3. Ver o preço novo no site", async () => {
      const p = await browser.newPage();
      await p.goto(`${SITE}/produtos/${slug}`, { waitUntil: "networkidle" });
      const opcoes = await p.$$eval("select option", (os) => os.map((o) => o.textContent));
      const esperado = novoTotal.toFixed(2).replace(".", ",");
      confere(
        opcoes.some((o) => o.includes(esperado)),
        `site não mostra R$ ${esperado}: ${opcoes[0]}`,
      );
      await p.close();
    });

    const email = `qa.cliente+${Date.now()}@homolog.local`;
    const cliente = await (
      await browser.newContext({ viewport: { width: 1280, height: 900 } })
    ).newPage();
    await etapa("4. Cadastro do cliente no site chega ao CRM", async () => {
      await cliente.goto(`${SITE}/cadastro`, { waitUntil: "networkidle" });
      await cliente.fill('input[name="full_name"]', "QA Cliente Jornada");
      await cliente.fill('input[name="document"]', cpfValido());
      await cliente.fill('input[name="phone"]', "(11) 90000-0000");
      await cliente.fill('input[name="email"]', email);
      await cliente.fill('input[name="password"]', SENHA_CLIENTE);
      await cliente.fill('input[name="password_confirm"]', SENHA_CLIENTE);
      await cliente.click('button[role="checkbox"]');
      await Promise.all([
        cliente.waitForURL(/\/painel/, { timeout: 60000 }),
        cliente.click('button:has-text("Criar conta")'),
      ]);
      confere(
        one(`select role from store.profiles where email = '${esc(email)}'`) === "cliente",
        "perfil de cliente não criado",
      );
      confere(
        one(`select count(*) from public.clients where email = '${esc(email)}'`) === "1",
        "cliente não chegou ao CRM",
      );
    });

    let pedido1;
    await etapa("5. Pedido no site, mesmo número e valor no CRM", async () => {
      pedido1 = await comprar(cliente, slug);
      const [num, total] = sql(
        `select number, total from store.orders where id = '${pedido1.orderId}'`,
      ).split("|");
      confere(
        valor(pedido1.totalCheckout) === Number(total).toFixed(2),
        `checkout mostrou ${pedido1.totalCheckout} antes de confirmar, o pedido saiu ${total}`,
      );
      confere(
        valor(pedido1.total) === Number(total).toFixed(2),
        `confirmação mostrou ${pedido1.total}, banco tem ${total}`,
      );
      confere(
        one(`select total_value from public.orders where order_number = '${num}'`) === total,
        "CRM com valor diferente",
      );
      confere(
        one(
          `select status from store.finance_entries where order_id = '${pedido1.orderId}' and type = 'receber'`,
        ) === "aberto",
        "conta a receber não aberta",
      );
      await crm.goto(`${CRM}/pedidos`, { waitUntil: "networkidle" });
      confere(
        (await crm.locator("main").last().innerText()).includes(num),
        "pedido não aparece na tela de Pedidos do CRM",
      );
      return `${num}: checkout ${pedido1.totalCheckout} = pedido ${pedido1.total}`;
    });

    let pedido2;
    await etapa("6. Segunda compra gera pedido novo, envio duplo gera um só", async () => {
      const antes = Number(
        one(
          `select count(*) from store.orders where customer_id = (select id from store.customers where email = '${esc(email)}')`,
        ),
      );
      pedido2 = await comprar(cliente, slug, { duploEnvio: true });
      const depois = Number(
        one(
          `select count(*) from store.orders where customer_id = (select id from store.customers where email = '${esc(email)}')`,
        ),
      );
      confere(pedido2.orderId !== pedido1.orderId, "segunda compra devolveu o pedido anterior");
      confere(depois === antes + 1, `envio duplo criou ${depois - antes} pedido(s)`);
      return numero(pedido2.orderId);
    });

    const admin = await loginAdminLoja(browser);
    await etapa("7. Pagamento confirmado: pedido, cobrança, financeiro e CRM", async () => {
      admin.once("dialog", (d) => d.accept("Pix recebido (jornada automática)"));
      await admin.goto(`${SITE}/admin/pedidos/${pedido1.orderId}`, { waitUntil: "networkidle" });
      await admin.click('button:has-text("Confirmar pagamento manualmente")');
      await ate(
        () =>
          one(`select payment_status from store.orders where id = '${pedido1.orderId}'`) === "pago",
        { segundos: 30, msg: "pagamento não confirmado" },
      );
      confere(
        one(`select status from store.payments where order_id = '${pedido1.orderId}'`) === "pago",
        "cobrança não paga",
      );
      confere(
        one(
          `select status from store.finance_entries where order_id = '${pedido1.orderId}' and type = 'receber'`,
        ) === "pago",
        "financeiro não baixado",
      );
      confere(
        one(
          `select payment_status from public.orders where order_number = '${numero(pedido1.orderId)}'`,
        ) === "pago",
        "CRM não mostra pago",
      );
    });

    await etapa("8. Produção: a OP arrastada no PCP do CRM conduz o pedido", async () => {
      await situacao(admin, pedido1.orderId, "aprovado_producao");
      const op = one(
        `select number from store.production_orders where order_id = '${pedido1.orderId}'`,
      );
      confere(op, "ordem de produção não criada");
      await crm.goto(`${CRM}/producao`, { waitUntil: "networkidle" });
      await crm.getByRole("tab", { name: /PCP/ }).click();
      // Arrastar entre colunas vizinhas; para longe, o seletor de etapa do card.
      const arrastar = async (coluna) => {
        const card = crm.locator(`[draggable="true"]:has-text("${op}")`).first();
        const destino = crm
          .locator("h3", { hasText: new RegExp(`^${coluna}$`) })
          .first()
          .locator("xpath=../..");
        await card.dragTo(destino);
      };
      const escolherEtapa = (etapa) =>
        crm.getByLabel(`Etapa da ${op}`).selectOption({ label: etapa });
      const situacaoPedido = () =>
        one(`select status from store.orders where id = '${pedido1.orderId}'`);
      await arrastar("Conferência");
      await ate(() => situacaoPedido() === "em_producao", {
        segundos: 30,
        msg: "OP arrastada para conferência não levou o pedido para em produção",
      });
      await escolherEtapa("Impressão");
      await ate(() => situacaoPedido() === "em_producao", {
        segundos: 30,
        msg: "OP em impressão não levou o pedido para em produção",
      });
      await escolherEtapa("Finalizado");
      await ate(() => situacaoPedido() === "pronto_retirada", {
        segundos: 30,
        msg: "OP finalizada não deixou o pedido pronto",
      });
      confere(
        one(
          `select production_status from public.orders where order_number = '${numero(pedido1.orderId)}'`,
        ) === "pronto",
        "CRM não acompanhou a produção",
      );
      await cliente.goto(`${SITE}/painel/pedidos`, { waitUntil: "networkidle" });
      confere(
        (await cliente.locator("main").last().innerText()).includes("Pronto para retirada"),
        "cliente não vê o pedido pronto",
      );
    });

    await etapa("9. Cancelamento ajusta cobrança, financeiro e CRM", async () => {
      await admin.goto(`${SITE}/admin/pedidos/${pedido2.orderId}`, { waitUntil: "networkidle" });
      await admin.click('button:has-text("Cancelar pedido")');
      const d = admin.locator('[role="dialog"], [role="alertdialog"]').last();
      await d.locator("textarea, input").first().fill("Cancelamento da jornada automática");
      await d.locator('button:has-text("Confirmar cancelamento")').click();
      await ate(
        () =>
          one(`select status from store.orders where id = '${pedido2.orderId}'`) === "cancelado",
        { segundos: 30, msg: "pedido não cancelado" },
      );
      confere(
        one(`select status from store.payments where order_id = '${pedido2.orderId}'`) ===
          "cancelado",
        "cobrança continua pendente",
      );
      confere(
        one(
          `select status from store.finance_entries where order_id = '${pedido2.orderId}' and type = 'receber'`,
        ) === "cancelado",
        "financeiro não cancelado",
      );
      confere(
        one(
          `select production_status from public.orders where order_number = '${numero(pedido2.orderId)}'`,
        ) === "cancelado",
        "CRM não mostra cancelado",
      );
      confere(
        one(`select payment_status from store.orders where id = '${pedido2.orderId}'`) ===
          "cancelado",
        "status de pagamento continua pendente",
      );
      confere(
        one(
          `select count(*) || '|' || max(note) from store.order_status_history where order_id = '${pedido2.orderId}' and to_status = 'cancelado'`,
        ) === "1|Cancelamento da jornada automática",
        "histórico do cancelamento duplicado ou sem motivo",
      );
    });

    await etapa("10. Arquivar pelo painel tira da loja; publicar traz de volta", async () => {
      await crm.goto(`${CRM}/integracao-nexus`, { waitUntil: "networkidle" });
      await crm.click('button[aria-label^="Ações de"]');
      await crm.click('[role="menuitem"]:has-text("Arquivar")');
      const d = crm.locator('[role="dialog"]').last();
      await d.locator("textarea").fill("Jornada automática: arquivar e republicar");
      await d.locator('button:has-text("Arquivar na loja")').click();
      await ate(
        () =>
          one(
            `select archived_at is not null and not active from store.products where id = '${storeId}'`,
          ) === "t",
        { segundos: 30, msg: "não arquivou" },
      );
      const p = await browser.newPage();
      await p.goto(`${SITE}/produtos/${slug}`, { waitUntil: "networkidle" });
      confere((await p.title()).includes("não encontrado"), "produto arquivado continua na loja");

      await crm.goto(`${CRM}/integracao-nexus`, { waitUntil: "networkidle" });
      await crm.click('button[aria-label^="Ações de"]');
      await crm.click('[role="menuitem"]:has-text("Publicar")');
      await ate(
        () =>
          one(
            `select active and archived_at is null from store.products where id = '${storeId}'`,
          ) === "t",
        { segundos: 60, msg: "não voltou para a loja" },
      );
      const aviso = one(
        `select payload -> 'warnings' from store.sync_log where destino_id = '${storeId}' and acao in ('insert','update') order by created_at desc limit 1`,
      );
      confere(
        !aviso.includes("direto na loja"),
        "republicação acusou edição na loja depois de arquivar pelo Flow",
      );
      await p.goto(`${SITE}/produtos/${slug}`, { waitUntil: "networkidle" });
      confere(!(await p.title()).includes("não encontrado"), "produto não voltou à loja");
      await p.close();
    });
  } catch {
    // o resumo abaixo mostra onde parou
  } finally {
    await browser.close();
    const falhas = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - falhas}/10 etapas ok${falhas ? " — FALHOU" : ""}`);
    process.exit(falhas || results.length < 10 ? 1 : 0);
  }
})();
