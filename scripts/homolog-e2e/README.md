# Jornada ponta a ponta na homologação local

Navegador real (Playwright) contra os dois apps em modo dev, apontados para o
stack Supabase local com a cópia da produção. Nada sai da máquina.

## Preparar

```bash
npx supabase start                                    # na pasta Printiflow
bash scripts/homolog-local.sh refresh <dump com privilégios>
npm run dev                                           # CRM em :8080
(cd ../Nexus-Printi && npm run dev)                   # site em :3000 (ou :3001 se ocupada)
cd scripts/homolog-e2e && npm i playwright@1.63.0
```

Os scripts usam o site em `http://localhost:3001`; ajuste `SITE` se ele subir na 3000.
Login local do dono (só existe no banco local): `dono@homolog.local` / `Homolog#2026`.

## Roteiro validado em 30/09/2026

| Passo | Comando | Confere |
|---|---|---|
| Importar e publicar | `node importar.js <link FuturaIM>` | "Publicado", link da loja, sem duplicar |
| Cadastro do cliente | `node cliente.js cadastro` | perfil `cliente`, `store.customers`, `public.clients` |
| Carrinho e checkout | `node cliente.js carrinho` / `node cliente.js pedido` | pedido único por compra |
| Pagamento | `node admin.js pedido <id> "nota" "Confirmar pagamento manualmente"` | pagamento, financeiro e espelho no CRM "pago" |
| Produção | `node admin.js situacao <id> aprovado_producao` | ordem em `store.production_orders` |
| Atualização de preço | `ANON_KEY=… node preco.js 50 59.90` | fila processa em até 1 min; site mostra o preço novo |
| Painel e telas do CRM | `node crm.js ver <nome> /integracao-nexus` | status real, fila, datas |
| Estado de um pedido | `psql -v num=NP-26-01005 -f estado-pedido.sql` | loja, pagamentos, financeiro, produção, CRM, histórico |
