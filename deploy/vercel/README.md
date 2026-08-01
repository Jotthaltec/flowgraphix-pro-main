# Deploy do CRM na Vercel

## Por que existe um adaptador aqui

O build do TanStack Start gera `dist/client` (só assets, **sem nenhum `index.html`**)
e `dist/server/server.js`, que é um handler `fetch(Request) => Response`. Sem
adaptador a Vercel não encontra nada para servir e **toda rota devolve
`404 NOT_FOUND`**.

[`scripts/build-vercel.mjs`](../../scripts/build-vercel.mjs) resolve isso gerando
`.vercel/output/` no formato Build Output API v3:

```
.vercel/output/
  config.json                      /assets imutável, filesystem, resto -> /index
  static/                          <- dist/client (servido pela CDN)
  functions/index.func/
    index.mjs                      handler + SSR + dependências, tudo empacotado
    .vc-config.json                nodejs22.x
```

O empacotamento é explícito (esbuild rodado por nós) em vez de depender da
detecção de framework da Vercel ou da ordem em que ela constrói um diretório
`api/`. O [`vercel.json`](../../vercel.json) só aponta o `buildCommand`.

## Variáveis de ambiente

No painel: **Project → Settings → Environment Variables**.

De build — são inlineadas no bundle do cliente, sem elas o app sobe sem falar
com o Supabase:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_LOJA_URL`

De runtime — usadas pelas server functions dentro da Serverless Function:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — sem ela o motor de combinações cai no anon e o RLS bloqueia
- `SUPABASE_PUBLISHABLE_KEY`
- `ANTHROPIC_API_KEY`

## Relação com o deploy da HostGator

Os dois destinos coexistem e saem do mesmo build. A tradução entre o `req`/`res`
do Node e o contrato Web mora em [`deploy/shared/node-web-bridge.mjs`](../shared/node-web-bridge.mjs),
usada tanto aqui quanto pelo `app.cjs` do Passenger — se mexer nela, mexe nos dois.

Se você decidir ficar só na Vercel, dá para apagar
[`.github/workflows/hostgator-deploy.yml`](../../.github/workflows/hostgator-deploy.yml)
e [`deploy/hostgator/`](../hostgator/); o `shared/` continua sendo necessário.
