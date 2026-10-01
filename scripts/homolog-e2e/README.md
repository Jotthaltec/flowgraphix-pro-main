# Jornada ponta a ponta na homologação local

Navegador real (Playwright) contra os dois apps em modo dev, apontados para o
stack Supabase local com a cópia da produção. Nada sai da máquina.

## Preparar

```bash
npx supabase start                                    # na pasta Printiflow
bash scripts/homolog-local.sh refresh <dump com privilégios>
npm run dev                                           # CRM em :8080
(cd ../Nexus-Printi && npm run dev)                   # site em :3000 (ou :3001 se ocupada)
# Playwright FORA do projeto: esta pasta não tem package.json, então "npm i" aqui
# sobe até o Printiflow e reinstala as dependências do CRM sem o lockfile
# (aconteceu em 30/09/2026: TanStack atualizado e CRM quebrado em dev).
mkdir -p ~/e2e-deps && cd ~/e2e-deps && echo '{"private":true}' > package.json && npm i playwright@1.63.0
export NODE_PATH=~/e2e-deps/node_modules   # os scripts acham o playwright por aqui
```

Os scripts usam o site em `http://localhost:3001`; ajuste `SITE` se ele subir na 3000.
Login local do dono (só existe no banco local): `dono@homolog.local` / `Homolog#2026`.

## Jornada automática

```bash
node jornada.cjs      # 10 etapas; sai com código 1 se alguma falhar (~3 min)
node atribuicao.cjs   # 7 etapas: anúncio → consentimento → pedido → pagamento → atribuição e Conversions API
```

Importar → publicar → preço pela fila → site → cadastro → pedido (e envio duplo)
→ pagamento → produção → cancelamento → arquivar e republicar. Cada etapa age
pela interface e confere o banco. Cria um cliente novo por execução.

## Passos avulsos (roteiro validado em 30/09/2026)

| Passo | Comando | Confere |
|---|---|---|
| Importar e publicar | `node importar.cjs <link FuturaIM>` | "Publicado", link da loja, sem duplicar |
| Cadastro do cliente | `node cliente.cjs cadastro` | perfil `cliente`, `store.customers`, `public.clients` |
| Carrinho e checkout | `node cliente.cjs carrinho` / `node cliente.cjs pedido` | pedido único por compra |
| Pagamento | `node admin.cjs pedido <id> "nota" "Confirmar pagamento manualmente"` | pagamento, financeiro e espelho no CRM "pago" |
| Produção | `node admin.cjs situacao <id> aprovado_producao` | ordem em `store.production_orders` |
| Atualização de preço | `ANON_KEY=… node preco.cjs 50 59.90` | fila processa em até 1 min; site mostra o preço novo |
| Painel e telas do CRM | `node crm.cjs ver <nome> /integracao-nexus` | status real, fila, datas |
| Estado de um pedido | `psql -v num=NP-26-01005 -f estado-pedido.sql` | loja, pagamentos, financeiro, produção, CRM, histórico |
