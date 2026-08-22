import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  cifrar,
  decifrar,
  decifrarOpcional,
  limparCacheDaChave,
  ChaveDeCifraInvalida,
  FalhaAoDecifrar,
} from "@/lib/channels/crypto";

// 32 bytes fixos — chave de teste, nunca usada em ambiente nenhum.
const CHAVE_A = Buffer.alloc(32, 1).toString("base64");
const CHAVE_B = Buffer.alloc(32, 2).toString("base64");

const chaveOriginal = process.env.CHANNELS_ENC_KEY;

beforeEach(() => {
  process.env.CHANNELS_ENC_KEY = CHAVE_A;
  limparCacheDaChave();
});

afterEach(() => {
  if (chaveOriginal === undefined) delete process.env.CHANNELS_ENC_KEY;
  else process.env.CHANNELS_ENC_KEY = chaveOriginal;
  limparCacheDaChave();
});

describe("cifra dos tokens de canal", () => {
  it("devolve o mesmo texto depois de cifrar e decifrar", async () => {
    const token = "APP_USR-1234567890-abcdef-token-do-mercado-livre";
    expect(await decifrar(await cifrar(token))).toBe(token);
  });

  it("preserva acento e emoji", async () => {
    const texto = "prazo de produção — 3 dias ✅";
    expect(await decifrar(await cifrar(texto))).toBe(texto);
  });

  it("gera texto cifrado diferente a cada chamada", async () => {
    // IV aleatório: dois tokens iguais não podem produzir o mesmo registro, ou
    // dá para deduzir que dois canais compartilham credencial só olhando o banco.
    const [a, b] = await Promise.all([cifrar("mesmo-token"), cifrar("mesmo-token")]);
    expect(a).not.toBe(b);
    expect(await decifrar(a)).toBe(await decifrar(b));
  });

  it("guarda no formato versionado, sem o texto claro dentro", async () => {
    const guardado = await cifrar("SEGREDO-NAO-PODE-VAZAR");
    expect(guardado.split(".")).toHaveLength(3);
    expect(guardado.startsWith("v1.")).toBe(true);
    expect(guardado).not.toContain("SEGREDO");
  });

  it("recusa texto adulterado em vez de devolver lixo", async () => {
    const guardado = await cifrar("token-original");
    const [versao, iv, cifra] = guardado.split(".");
    const adulterado = `${versao}.${iv}.${cifra.slice(0, -4)}AAAA`;

    await expect(decifrar(adulterado)).rejects.toThrow(FalhaAoDecifrar);
  });

  it("recusa formato desconhecido", async () => {
    await expect(decifrar("texto-solto")).rejects.toThrow(FalhaAoDecifrar);
    await expect(decifrar("v9.aaa.bbb")).rejects.toThrow(FalhaAoDecifrar);
  });

  it("não decifra com outra chave", async () => {
    const guardado = await cifrar("token");

    process.env.CHANNELS_ENC_KEY = CHAVE_B;
    limparCacheDaChave();

    await expect(decifrar(guardado)).rejects.toThrow(FalhaAoDecifrar);
  });

  it("falha alto quando a chave não está configurada", async () => {
    delete process.env.CHANNELS_ENC_KEY;
    limparCacheDaChave();

    await expect(cifrar("x")).rejects.toThrow(ChaveDeCifraInvalida);
  });

  it("falha quando a chave tem tamanho errado", async () => {
    process.env.CHANNELS_ENC_KEY = Buffer.alloc(16, 1).toString("base64");
    limparCacheDaChave();

    await expect(cifrar("x")).rejects.toThrow(/32 bytes/);
  });

  it("permite corrigir a chave sem reiniciar o processo", async () => {
    delete process.env.CHANNELS_ENC_KEY;
    limparCacheDaChave();
    await expect(cifrar("x")).rejects.toThrow(ChaveDeCifraInvalida);

    // A promessa rejeitada não pode ficar em cache — senão a variável corrigida
    // continuaria falhando até o próximo deploy.
    process.env.CHANNELS_ENC_KEY = CHAVE_A;
    await expect(cifrar("x")).resolves.toBeTypeOf("string");
  });

  it("trata coluna nula sem explodir", async () => {
    expect(await decifrarOpcional(null)).toBeUndefined();
    expect(await decifrarOpcional(undefined)).toBeUndefined();
    expect(await decifrarOpcional("")).toBeUndefined();
  });
});
