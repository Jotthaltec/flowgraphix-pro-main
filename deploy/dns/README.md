# Zona DNS de `nexusprinti.com.br`

Inventário levantado em 16/08/2026 consultando o nameserver autoritativo
(`ns00178.hostgator.com.br`), não um resolvedor público — o que está aqui é o que
a zona declara, sem interferência de cache.

O domínio é registrado no **Registro.br**. Os nameservers apontam para a
HostGator, que hoje entrega **só DNS e a plataforma de e-mail**: nenhum site é
servido por ela.

## Inventário completo — 22 registros

| Nome            | Tipo  | Valor                                    | Serve para          |
| --------------- | ----- | ---------------------------------------- | ------------------- |
| `@`             | A     | `216.198.79.1`                           | loja (Vercel)       |
| `@`             | MX 10 | `mx1.titan.email`                        | e-mail              |
| `@`             | MX 20 | `mx2.titan.email`                        | e-mail              |
| `@`             | TXT   | `v=spf1 include:spf.titan.email ~all`    | SPF                 |
| `@`             | NS    | `ns00178` / `ns00179.hostgator.com.br`   | delegação           |
| `www`           | CNAME | `26d98b8107a694c7.vercel-dns-017.com`    | loja (Vercel)       |
| `printiflow`    | CNAME | `26d98b8107a694c7.vercel-dns-017.com`    | **CRM (Vercel)**    |
| `mail`          | A     | `69.6.249.151`                           | e-mail              |
| `webmail`       | CNAME | `titan.hostgator.com.br`                 | webmail Titan       |
| `autodiscover`  | A     | `69.6.249.151`                           | autoconfig de e-mail|
| `autoconfig`    | A     | `69.6.249.151`                           | autoconfig de e-mail|
| `whm`           | A     | `69.6.249.151`                           | painel HostGator    |
| `webdisk`       | A     | `69.6.249.151`                           | cPanel              |
| `cpcalendars`   | A     | `69.6.249.151`                           | cPanel              |
| `cpcontacts`    | A     | `69.6.249.151`                           | cPanel              |
| `cpanel`        | CNAME | `nexusprinti.com.br`                     | ⚠️ quebrado          |
| `ftp`           | CNAME | `nexusprinti.com.br`                     | ⚠️ quebrado          |
| `titan1._domainkey`  | TXT | `v=DKIM1; k=rsa; p=MIGfMA0…` (1024 bits) | **DKIM**       |
| `default._domainkey` | TXT | `v=DKIM1; k=rsa; p=MIIBIjAN…` (2048 bits)| **DKIM**       |
| `_acme-challenge`    | TXT | `E0N2U9sPIWYdGo6ZSy5kEjYOjji_XB6rep5wdPY5MS0` | validação de certificado |

Os valores integrais das chaves DKIM estão em DNS público — recupere com:

```bash
dig +short TXT titan1._domainkey.nexusprinti.com.br @ns00178.hostgator.com.br
```

### Duas observações

- **`cpanel.` e `ftp.` são CNAME para a raiz**, que resolve para a Vercel. Ou
  seja, apontam para o lugar errado e não servem para nada. O painel real
  responde em `whm.nexusprinti.com.br`. Não replique esses dois na migração:
  corrija-os ou descarte-os.
- **Não existe DMARC.** Ver a proposta em [`deploy/resend/README.md`](../resend/README.md).

## Migração para o Cloudflare

### A armadilha que quase passou batido

O import automático do Cloudflare varre nomes previsíveis. Registros com
underscore — `titan1._domainkey`, `default._domainkey`, `_acme-challenge` — são
os que mais escapam, porque não há como adivinhá-los.

Perder um DKIM **não derruba o e-mail de imediato**: as mensagens continuam
saindo, mas falham a assinatura e passam a cair em spam. É uma falha silenciosa,
que só aparece dias depois, quando clientes dizem que não receberam. **Confira os
dois `_domainkey` um a um antes de trocar os nameservers.**

### Ordem segura

1. **Não migre junto com a configuração do Resend.** São duas mudanças de DNS ao
   mesmo tempo; se a entrega quebrar, não há como saber qual causou. Faça o
   Resend primeiro, confirme que o e-mail chega, e só então migre.
2. Recrie os 22 registros no Cloudflare e confira **um a um** contra a tabela
   acima, com atenção especial aos dois DKIM.
3. Baixe o TTL dos registros críticos para 300s **antes** da troca — encurta a
   janela de rollback.
4. Deixe todos os registros como **DNS only** (nuvem cinza). O proxy do Cloudflare
   na frente da Vercel gera dupla camada de CDN e quebra a validação de
   certificado; e registros de e-mail nunca podem ser proxiados.
5. Só então troque os nameservers no Registro.br.
6. Depois de propagar, confirme: loja, CRM, envio **e recebimento** de e-mail.

### Rollback

Os nameservers atuais são `ns00178.hostgator.com.br` e
`ns00179.hostgator.com.br`. Voltar a apontar para eles no Registro.br restaura a
zona da HostGator, que continua existindo enquanto o Plano M estiver ativo
(vence em 21/03/2027).

> ⚠️ **Nunca** crie MX em `printiflow.nexusprinti.com.br`. Ele precisa do CNAME da
> Vercel, e MX no mesmo nome impede o CNAME — foi exatamente o que manteve o CRM
> fora do ar.
