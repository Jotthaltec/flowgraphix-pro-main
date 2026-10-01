// Confere, na homologação local, as correções de colunas inexistentes achadas
// ao tipar o CRM: tela Clientes (totais), ficha técnica (coluna value) e
// impressão da OP (whatsapp + value). Cria uma OP de apoio na empresa do
// dono e a remove no fim. Rode com HOMOLOG_ANON_KEY (npx supabase status).
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");

const CRM = process.env.HOMOLOG_CRM || "http://localhost:8080";
const API = "http://127.0.0.1:54321";
const ITEM = "11111111-0000-4000-8000-000000000003";
const ATTR = "11111111-0000-4000-8000-000000000001";
const ANON = process.env.HOMOLOG_ANON_KEY;

const sql = (q) =>
  execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_gkbbzypdakjrvxwvfjlc", "psql", "-U", "postgres", "-tA", "-c", q],
    {
      encoding: "utf8",
    },
  ).trim();

let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? " — " + detalhe : ""}`);
  if (!ok) falhas++;
};

const DONO_EMPRESA = () =>
  sql(
    "select p.company_id from public.profiles p join auth.users u on u.id = p.user_id where u.email = 'dono@homolog.local'",
  );

function criarApoio() {
  const empresa = DONO_EMPRESA();
  const cliente = sql(
    `select id from public.clients where company_id = '${empresa}' order by created_at limit 1`,
  );
  const produto = sql(`select id from public.products where company_id = '${empresa}' limit 1`);
  sql(
    `update public.clients set whatsapp = coalesce(whatsapp, '81999990000') where id = '${cliente}'`,
  );
  sql(`insert into public.technical_attributes (id, company_id, name, code, type)
       values ('${ATTR}', '${empresa}', 'Papel E2E', 'PAPEL_E2E', 'text') on conflict (id) do nothing`);
  sql(`insert into public.production_orders (id, company_id, order_number, client_id, status)
       values ('11111111-0000-4000-8000-000000000002', '${empresa}', '', '${cliente}', 'aprovado')
       on conflict (id) do nothing`);
  sql(`insert into public.production_order_items (id, production_order_id, product_id, quantity, status)
       values ('${ITEM}', '11111111-0000-4000-8000-000000000002', '${produto}', 100, 'aguardando')
       on conflict (id) do nothing`);
  return {
    nome: sql(`select name from public.clients where id = '${cliente}'`),
    whatsapp: sql(`select whatsapp from public.clients where id = '${cliente}'`),
  };
}

function removerApoio() {
  sql(`delete from public.production_item_attributes where production_order_item_id = '${ITEM}'`);
  sql(`delete from public.production_order_items where id = '${ITEM}'`);
  sql(`delete from public.production_orders where id = '11111111-0000-4000-8000-000000000002'`);
  sql(`delete from public.technical_attributes where id = '${ATTR}'`);
}

(async () => {
  const apoio = criarApoio();
  // 1) Ficha técnica: mesmo delete+insert do editor, como o dono, via PostgREST.
  const tok = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "dono@homolog.local", password: "Homolog#2026" }),
  }).then((r) => r.json());
  const h = {
    apikey: ANON,
    Authorization: `Bearer ${tok.access_token}`,
    "Content-Type": "application/json",
  };
  await fetch(`${API}/rest/v1/production_item_attributes?production_order_item_id=eq.${ITEM}`, {
    method: "DELETE",
    headers: h,
  });
  const ins = await fetch(`${API}/rest/v1/production_item_attributes`, {
    method: "POST",
    headers: h,
    body: JSON.stringify([
      { production_order_item_id: ITEM, attribute_id: ATTR, value: "Couchê 300g" },
    ]),
  });
  check("ficha técnica grava com a coluna value", ins.ok, `HTTP ${ins.status}`);
  const old = await fetch(`${API}/rest/v1/production_item_attributes`, {
    method: "POST",
    headers: h,
    body: JSON.stringify([
      { production_order_item_id: ITEM, attribute_id: ATTR, attribute_value: "x" },
    ]),
  });
  check("formato antigo (attribute_value) de fato falhava", !old.ok, `HTTP ${old.status}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${CRM}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "dono@homolog.local");
  await page.fill('input[type="password"]', "Homolog#2026");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }),
    page.click('button:has-text("Entrar")'),
  ]);

  // 2) Clientes: a lista carrega (antes a consulta pedia colunas inexistentes).
  const erros = [];
  page.on("response", (r) => {
    if (r.url().includes("/rest/v1/") && r.status() >= 400) erros.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(`${CRM}/clientes`, { waitUntil: "networkidle" });
  const nClientes = Number(sql("select count(*) from public.clients"));
  await page.waitForSelector("tbody tr", { timeout: 20000 });
  const linhas = await page.locator("tbody tr").count();
  check("Clientes lista os cadastros", linhas === nClientes, `${linhas}/${nClientes} linhas`);
  check("Clientes sem erro de API", erros.length === 0, erros.join(" | "));

  // 3) Impressão da OP: cliente, WhatsApp e valor do atributo aparecem.
  erros.length = 0;
  await page.goto(`${CRM}/print-op/${ITEM}`, { waitUntil: "networkidle" });
  const corpo = await page.locator("body").innerText();
  check(
    "Impressão da OP carrega",
    !corpo.includes("Erro ao carregar") && erros.length === 0,
    erros.join(" | "),
  );
  check("Impressão mostra o cliente", corpo.includes(apoio.nome));
  check("Impressão mostra o WhatsApp", corpo.includes(apoio.whatsapp));
  check("Impressão mostra o valor do atributo", corpo.includes("Couchê 300g"));
  await page.screenshot({ path: __dirname + "/shots/correcoes-print-op.png", fullPage: true });

  await browser.close();
  removerApoio();
  console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo.");
  process.exit(falhas ? 1 : 0);
})().catch((e) => {
  console.error(e);
  removerApoio();
  process.exit(1);
});
