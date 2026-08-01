# Deploy do CRM na HostGator

O workflow [`hostgator-deploy.yml`](../../.github/workflows/hostgator-deploy.yml) roda
a cada push na `main`: builda o app e envia o resultado por FTPS explícito (porta 21).

Este CRM **não é um site estático**. É um app SSR (TanStack Start) com 19 server
functions — o motor de combinações usa a `SUPABASE_SERVICE_ROLE_KEY` e o importador
raspa a FuturaIM server-side. Por isso ele roda no **Configurar Aplicativo Node.js**
do cPanel, e não solto em `public_html`.

## O que sobe a cada deploy

```
app.cjs              adaptador que liga o Passenger ao build SSR
package.json         usado pelo "Run NPM Install" do cPanel
package-lock.json
.npmrc               omit=dev — não instala vite/typescript no servidor
dist/client/         assets do navegador
dist/server/         bundle do SSR
tmp/restart.txt      mtime novo a cada deploy => Passenger reinicia sozinho
```

## Configuração inicial no cPanel (uma vez só)

1. **cPanel → Software → Configurar Aplicativo Node.js → Create Application**
2. Preencha:
   - **Node.js version:** 20 ou superior (o adaptador usa `Readable.toWeb`)
   - **Application mode:** Production
   - **Application root:** a mesma pasta em que o FTP entrega os arquivos
     (por padrão a home do usuário FTP — veja `FTP_SERVER_DIR` abaixo)
   - **Application URL:** `printiflow.nexusprinti.com.br`
   - **Application startup file:** `app.cjs`
3. Em **Environment variables**, adicione as chaves de runtime — elas **não** vêm
   do GitHub, ficam só aqui:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (sem ela o motor de combinações cai no anon e o RLS bloqueia)
   - `SUPABASE_PUBLISHABLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `NODE_ENV=production`
4. Rode o **Run NPM Install** do painel.
5. **Restart**.

Depois disso o ciclo é automático: push na `main` → build → FTPS → Passenger reinicia.

> **Quando as dependências mudarem** (`package.json` alterado), rode o
> **Run NPM Install** de novo — o FTP entrega o `package.json` novo, mas quem
> instala é o cPanel.

## Secrets e variáveis no GitHub

Secrets (**Settings → Secrets and variables → Actions → Secrets**):

| Secret | Papel |
| --- | --- |
| `FTP_SERVER` | host do FTP |
| `FTP_USERNAME` | usuário do FTP |
| `FTP_PASSWORD` | senha do FTP |
| `VITE_SUPABASE_URL` | inlineado no bundle do cliente |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | idem |
| `VITE_SUPABASE_PROJECT_ID` | idem |
| `VITE_LOJA_URL` | idem |

Variável opcional (**aba Variables**):

| Variável | Padrão | Quando mexer |
| --- | --- | --- |
| `FTP_SERVER_DIR` | `/` | Se o usuário FTP cair acima da pasta do app. Ex.: `/printiflow.nexusprinti.com.br/`. Precisa terminar com `/`. |

## O host de FTP que o painel mostra não funciona

A HostGator exibe `ftp.jonathaslucasdesouza1774074438938.0322138.meusitehostgator.com.br`,
mas esse nome resolve para IPs da Cloudflare (`104.18.42.56`, `172.64.145.200`) — e a
Cloudflare não faz proxy de FTP. A porta 21 nele simplesmente dá timeout.

Por isso `FTP_SERVER` usa **`printiflow.nexusprinti.com.br`**, que aponta direto para
o servidor real (`69.6.249.151`, Pure-FTPd com certificado `*.hostgator.com.br`).
