# E-mail transacional do CRM (Resend)

O CRM envia ao cliente final a cópia do **orçamento** e do **contrato**. Quem
monta a mensagem são os templates puros em
[`src/services/email/templates.ts`](../../src/services/email/templates.ts); quem
entrega é [`src/services/email/resend.server.ts`](../../src/services/email/resend.server.ts).

Isto é envio **transacional**, disparado por código. Não é caixa postal: não
substitui as caixas do Titan e ninguém "acessa o webmail do Resend".

## Por que Resend e não o SMTP embutido do Supabase

Hoje o único e-mail que o sistema dispara é o de recuperação de senha, pelo
serviço padrão do Supabase. A documentação deles é explícita:

> O serviço tem um limite de envios por hora e a disponibilidade é feita em
> regime de melhor esforço. Para uso em produção, configure um SMTP próprio.

Um "esqueci minha senha" que não chega é um usuário trancado fora do CRM.

## Passo 1 — Domínio de envio dedicado

**Não** verifique o `nexusprinti.com.br` direto. Use um subdomínio só para envio,
por exemplo `envios.nexusprinti.com.br`.

Dois motivos concretos:

1. O SPF do domínio raiz hoje é `v=spf1 include:spf.titan.email ~all`. **Dois
   registros SPF no mesmo nome invalidam os dois** — mexer ali arrisca a entrega
   de todo o e-mail existente. Um subdomínio tem o SPF dele, isolado.
2. Se um disparo do CRM cair em spam, a reputação queimada é a do subdomínio, não
   a do domínio principal.

> ⚠️ **Cuidado que já derrubou este sistema uma vez.** O Resend pede um registro
> MX no subdomínio de envio (para bounces). Isso é seguro em `envios.`, que é um
> nome novo. **Nunca** aponte MX para `printiflow.nexusprinti.com.br`: aquele
> subdomínio precisa do CNAME da Vercel, e MX no mesmo nome impede o CNAME — foi
> exatamente o que manteve o CRM fora do ar. Ver o histórico em
> [`deploy/vercel/README.md`](../vercel/README.md).

## Passo 2 — Registros DNS

No painel do Resend, em **Domains → Add Domain**, informe `envios.nexusprinti.com.br`.
Ele gera os registros — **copie os valores exatos que aparecem lá**, porque a
chave DKIM é única por domínio. O conjunto tem esta forma:

| Tipo  | Nome                        | Para que serve          |
| ----- | --------------------------- | ----------------------- |
| MX    | `envios`                    | recebimento de bounces  |
| TXT   | `envios`                    | SPF do subdomínio       |
| TXT   | `resend._domainkey.envios`  | assinatura DKIM         |

Esses registros entram onde o DNS é **autoritativo**. Hoje isso é a HostGator
(nameservers `ns00178`/`ns00179.hostgator.com.br`). Se o DNS for migrado para o
Cloudflare, passam a ser criados lá.

### DMARC

O domínio não tem DMARC. Vale criar, começando em modo só-observação — ele não
rejeita nada, apenas coleta relatórios:

| Tipo | Nome     | Valor                                              |
| ---- | -------- | -------------------------------------------------- |
| TXT  | `_dmarc` | `v=DMARC1; p=none; rua=mailto:SEU-EMAIL@dominio`   |

Só endureça para `p=quarantine` depois de os relatórios mostrarem SPF e DKIM
passando.

## Passo 3 — Variáveis de ambiente

Na Vercel, em **Project → Settings → Environment Variables** (e no `.env` local):

```
RESEND_API_KEY=re_...
RESEND_FROM=Nexus Printi <orcamentos@envios.nexusprinti.com.br>
```

O `RESEND_FROM` precisa usar o domínio verificado no passo 1, senão o Resend
recusa o envio com HTTP 422 `domain not verified`.

A `RESEND_API_KEY` **nunca** leva prefixo `VITE_`: esse prefixo faz o Vite
inlinear o valor no bundle do navegador, o que entregaria a qualquer visitante o
poder de enviar e-mail em nome do domínio.

## Passo 4 (opcional) — Resend como SMTP do Supabase Auth

Resolve o limite do serviço padrão nos e-mails de senha e cadastro. No painel do
Supabase, em **Authentication → Emails → SMTP Settings**, use as credenciais SMTP
que o Resend fornece.

Atenção a um detalhe que costuma surpreender: com SMTP próprio, o limite padrão
do Supabase passa a ser de **30 novos usuários por hora**. É configurável em
**Authentication → Rate Limits**.

## Como usar no código

```ts
import { renderQuoteEmail } from '@/services/email/templates';
import { sendEmail } from '@/services/email/resend.server';

const email = renderQuoteEmail({
  quoteNumber: quote.quote_number,
  clientName: client.name,
  serviceDesc: quote.service_desc,
  quantity: quote.quantity,
  finalValue: quote.final_value,
  validUntil: quote.valid_until,
  deliveryDays: quote.delivery_days,
  notes: quote.notes,
  companyName: company.name,
});

await sendEmail({ to: client.email, ...email, replyTo: 'contato@nexusprinti.com.br' });
```

`sendEmail` só roda no servidor — chame de dentro de uma server function, nunca
de um componente. O `client.email` é anulável em `clients`: valide antes de
chamar, ou o envio falha com "destinatário inválido".

## O que ainda não existe

- **Anexo em PDF.** O projeto não tem geração de PDF; hoje o orçamento e o
  contrato vão no corpo do e-mail, em HTML. Anexar exige escolher uma biblioteca.
- **Botão na interface.** A camada de envio está pronta e testada, mas nenhuma
  tela chama ela ainda.
- **Registro de envios.** Não há tabela guardando o que foi enviado e quando.
