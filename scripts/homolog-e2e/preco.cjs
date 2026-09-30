// Altera o preço de venda de uma tiragem no Flow, como o editor do CRM faz
// (public.products.quantity_prices), com a sessão do dono e o RLS normal.
// Uso: node preco.cjs <quantidade> <novo total>
const API = "http://127.0.0.1:54321";
const KEY = process.env.ANON_KEY;

(async () => {
  const [qty, total] = process.argv.slice(2).map(Number);
  const auth = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "dono@homolog.local", password: "Homolog#2026" }),
  }).then((r) => r.json());
  const h = {
    apikey: KEY,
    Authorization: `Bearer ${auth.access_token}`,
    "Content-Type": "application/json",
  };

  const [product] = await fetch(`${API}/rest/v1/products?select=id,name,quantity_prices&limit=1`, {
    headers: h,
  }).then((r) => r.json());
  const rows = product.quantity_prices.map((row) =>
    row.quantity === qty
      ? { ...row, sellPrice: total, unitSellPrice: Math.round((total / qty) * 10000) / 10000 }
      : row,
  );
  const res = await fetch(`${API}/rest/v1/products?id=eq.${product.id}`, {
    method: "PATCH",
    headers: { ...h, Prefer: "return=representation" },
    body: JSON.stringify({ quantity_prices: rows }),
  });
  const body = await res.json();
  console.log(
    `HTTP ${res.status}`,
    product.name,
    "->",
    body[0]?.quantity_prices?.find((r) => r.quantity === qty),
  );
})();
