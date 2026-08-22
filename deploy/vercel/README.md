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
- `SUPABASE_SECRET_KEY` — chave secreta moderna, somente no servidor; a antiga
  `SUPABASE_SERVICE_ROLE_KEY` continua aceita temporariamente para migração
- `SUPABASE_PUBLISHABLE_KEY`
- `ANTHROPIC_API_KEY`
- `CHANNELS_ENC_KEY` — 32 bytes em base64; cifra tokens de canais e deve ser
  preservada entre deploys. Trocar o valor invalida credenciais já armazenadas.
- `RESEND_API_KEY` e `RESEND_FROM` — envio de orçamentos e contratos ao cliente.
  Ver [`deploy/resend/README.md`](../resend/README.md)

## Único destino de deploy

O CRM sai só pela Vercel. Havia um segundo destino (Passenger na HostGator, por
FTPS) que foi removido em 15/08/2026: o domínio e o subdomínio já apontavam para
a Vercel, então aquele workflow publicava a cada push para um servidor que
ninguém alcançava.

A tradução entre o `req`/`res` do Node e o contrato Web continua em
[`deploy/shared/node-web-bridge.mjs`](../shared/node-web-bridge.mjs), separada do
handler por ser a parte testável.

Para ressuscitar o deploy da HostGator, o commit que o removeu traz o workflow e
o `deploy/hostgator/` inteiros — basta revertê-lo.
