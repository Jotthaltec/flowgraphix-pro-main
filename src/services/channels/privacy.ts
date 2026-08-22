/**
 * PODA DE DADOS PESSOAIS DO PAYLOAD DO CANAL.
 *
 * `channel_orders.raw` existe para responder "por que este pedido entrou assim"
 * — é ferramenta de diagnóstico, não fonte de dado. O que o sistema realmente
 * usa (nome, endereço de entrega, itens) já foi extraído para colunas em
 * `store.orders`/`store.order_items` antes de chegar aqui.
 *
 * Guardar o payload cru inteiro seria acumular CPF, telefone, e-mail e dados de
 * pagamento do comprador indefinidamente, numa tabela que ninguém lê no dia a
 * dia. Mercado Livre e Shopee restringem isso nos termos de uso, e a LGPD chama
 * de minimização. Então o raw entra redigido.
 *
 * A poda é por NOME DE CHAVE e recursiva, porque a forma do payload muda entre
 * provedores e entre versões da API — uma lista de caminhos fixos ficaria
 * desatualizada em silêncio, que é o pior modo de falhar para uma proteção.
 */

/** Marca deixada no lugar do valor removido, para o diagnóstico não confundir com ausência. */
export const VALOR_REDIGIDO = "[removido: dado pessoal]";

/**
 * Chaves cujo VALOR é redigido, em qualquer profundidade.
 *
 * A comparação é feita de duas formas porque uma só não serve. Por SUBSTRING na
 * chave sem separadores — assim `doc_number`, `docNumber` e `DOC-NUMBER` caem na
 * mesma regra. E por PALAVRA INTEIRA para os termos curtos: `ip` como substring
 * redigiria `shipping` e `description`, ou seja, apagaria justamente o endereço
 * de entrega que o módulo precisa para despachar o pedido.
 */
const TRECHOS_SENSIVEIS = [
  "cpf",
  "cnpj",
  "docnumber",
  "documento",
  "identification",
  "taxid",
  "birthdate",
  "datanascimento",
  "email",
  "phone",
  "telefone",
  "celular",
  "whatsapp",
  "areacode",
  "password",
  "creditcard",
  "cardnumber",
  "cartao",
  "billinginfo",
  "payer",
  "authorization",
];

/** Termos curtos demais para busca por substring — só valem como palavra inteira. */
const PALAVRAS_SENSIVEIS = ["ip", "senha", "token", "secret", "doc", "rg"];

/** Limite de tamanho do payload guardado — diagnóstico não precisa de megabytes. */
const LIMITE_BYTES = 64 * 1024;

/**
 * Quebra a chave em palavras, entendendo `snake_case`, `kebab-case` e
 * `camelCase`: `client_ip` e `ipAddress` viram ambos uma palavra `ip`, enquanto
 * `shipping` continua sendo uma palavra só.
 */
function palavrasDaChave(chave: string): string[] {
  return chave
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((p) => p.toLowerCase());
}

function chaveSensivel(chave: string): boolean {
  const normalizada = chave.toLowerCase().replace(/[^a-z]/g, "");
  if (TRECHOS_SENSIVEIS.some((trecho) => normalizada.includes(trecho))) return true;

  const palavras = palavrasDaChave(chave);
  return palavras.some((palavra) => PALAVRAS_SENSIVEIS.includes(palavra));
}

function redigir(valor: unknown, profundidade: number): unknown {
  // Profundidade máxima protege contra payload com ciclo ou aninhamento absurdo.
  if (profundidade > 12) return "[removido: profundidade máxima]";

  if (Array.isArray(valor)) {
    return valor.map((item) => redigir(item, profundidade + 1));
  }
  if (valor !== null && typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const [chave, conteudo] of Object.entries(valor as Record<string, unknown>)) {
      saida[chave] = chaveSensivel(chave) ? VALOR_REDIGIDO : redigir(conteudo, profundidade + 1);
    }
    return saida;
  }
  return valor;
}

/**
 * Devolve uma cópia do payload sem dados pessoais e dentro do limite de tamanho.
 * Chamar SEMPRE antes de gravar em `channel_orders.raw` ou `channel_sync_log.payload`.
 */
export function podarPayload(payload: unknown): unknown {
  if (payload === undefined || payload === null) return null;

  const podado = redigir(payload, 0);

  let serializado: string;
  try {
    serializado = JSON.stringify(podado);
  } catch {
    // Payload não serializável (ciclo, BigInt) não vale um erro no meio da
    // importação do pedido — o diagnóstico é secundário.
    return { aviso: "payload não serializável" };
  }

  if (serializado.length > LIMITE_BYTES) {
    return {
      aviso: `payload truncado (${serializado.length} bytes, limite ${LIMITE_BYTES})`,
      inicio: serializado.slice(0, LIMITE_BYTES),
    };
  }
  return podado;
}
