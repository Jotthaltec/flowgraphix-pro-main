/**
 * CIFRA DOS TOKENS DE CANAL.
 *
 * `channel_secrets` já é inacessível ao navegador (sem GRANT e com RLS sem
 * policy). Isto é a camada de baixo: mesmo com um dump do banco em mãos, o
 * token do marketplace não sai em claro. São proteções contra ameaças
 * diferentes — a do banco cobre acesso pela API, esta cobre acesso ao dado.
 *
 * AES-256-GCM pela Web Crypto, e não uma biblioteca: `crypto.subtle` existe no
 * Node 18+ e no runtime da Cloudflare, os dois alvos de build deste projeto
 * (`vite.config.ts` monta o server entry, `wrangler.jsonc` existe no repo).
 * Nada de dependência nova para uma operação que a plataforma já oferece.
 *
 * GCM é autenticado: adulterar o texto cifrado faz a decifragem FALHAR em vez
 * de devolver lixo silenciosamente. É o que garante que um token corrompido
 * apareça como canal com erro, e não como chamada de API misteriosamente negada.
 *
 * O formato guardado é `v1.<iv>.<cifra>`, em base64url. O prefixo de versão é o
 * que vai permitir trocar de algoritmo ou girar a chave sem adivinhar o que há
 * em cada linha.
 */

const VERSAO = "v1";
const TAMANHO_IV = 12; // 96 bits — o recomendado para GCM
const TAMANHO_CHAVE = 32; // 256 bits

/** Erro de configuração: a chave não existe ou não serve. */
export class ChaveDeCifraInvalida extends Error {
  constructor(motivo: string) {
    super(
      `CHANNELS_ENC_KEY ${motivo}. Gere uma chave com: ` +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
    this.name = "ChaveDeCifraInvalida";
  }
}

/** Erro de decifragem — token corrompido ou cifrado com outra chave. */
export class FalhaAoDecifrar extends Error {
  constructor() {
    super(
      "Não foi possível decifrar o token do canal. " +
        "A CHANNELS_ENC_KEY mudou ou o dado está corrompido — reconecte o canal.",
    );
    this.name = "FalhaAoDecifrar";
  }
}

function base64ParaBytes(base64: string): Uint8Array {
  const normalizado = base64.replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(normalizado);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function bytesParaBase64url(bytes: Uint8Array): string {
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let chaveEmCache: Promise<CryptoKey> | undefined;

/**
 * Carrega a chave do ambiente. Falha ALTO e na primeira chamada: um canal que
 * "conecta" mas não consegue guardar o token direito é pior do que um canal que
 * se recusa a conectar.
 */
function carregarChave(): Promise<CryptoKey> {
  if (chaveEmCache) return chaveEmCache;

  chaveEmCache = (async () => {
    const bruta = process.env.CHANNELS_ENC_KEY;
    if (!bruta) throw new ChaveDeCifraInvalida("não está configurada");

    let bytes: Uint8Array;
    try {
      bytes = base64ParaBytes(bruta.trim());
    } catch {
      throw new ChaveDeCifraInvalida("não é base64 válido");
    }
    if (bytes.length !== TAMANHO_CHAVE) {
      throw new ChaveDeCifraInvalida(
        `precisa ter ${TAMANHO_CHAVE} bytes depois do base64 (veio com ${bytes.length})`,
      );
    }

    return crypto.subtle.importKey("raw", bytes as BufferSource, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  })();

  // Não deixa a promessa rejeitada em cache: com a variável corrigida e o
  // processo ainda de pé, a próxima chamada precisa poder tentar de novo.
  chaveEmCache.catch(() => {
    chaveEmCache = undefined;
  });

  return chaveEmCache;
}

/** Descarta a chave em cache. Só para teste. */
export function limparCacheDaChave(): void {
  chaveEmCache = undefined;
}

/** Cifra um token para guardar em `channel_secrets`. */
export async function cifrar(textoClaro: string): Promise<string> {
  const chave = await carregarChave();
  const iv = crypto.getRandomValues(new Uint8Array(TAMANHO_IV));

  const cifrado = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    chave,
    new TextEncoder().encode(textoClaro),
  );

  return `${VERSAO}.${bytesParaBase64url(iv)}.${bytesParaBase64url(new Uint8Array(cifrado))}`;
}

/** Decifra um token lido de `channel_secrets`. */
export async function decifrar(guardado: string): Promise<string> {
  const partes = guardado.split(".");
  if (partes.length !== 3 || partes[0] !== VERSAO) throw new FalhaAoDecifrar();

  const chave = await carregarChave();
  try {
    const claro = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ParaBytes(partes[1]) as BufferSource },
      chave,
      base64ParaBytes(partes[2]) as BufferSource,
    );
    return new TextDecoder().decode(claro);
  } catch {
    // Engole a causa de propósito: a mensagem original da Web Crypto não diz
    // nada útil e mencioná-la só faria vazar detalhe de implementação no log.
    throw new FalhaAoDecifrar();
  }
}

/** Decifra quando há valor; devolve `undefined` para coluna nula. */
export async function decifrarOpcional(guardado: string | null | undefined): Promise<string | undefined> {
  if (!guardado) return undefined;
  return decifrar(guardado);
}
