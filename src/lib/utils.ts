import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Mensagem de um erro capturado. Cobre `Error`, erro do Supabase (objeto com
 * `message`, que não é instância de Error) e valor solto.
 */
export function errorMessage(err: unknown, fallback = ""): string {
  if (err && typeof err === "object" && "message" in err) {
    const { message } = err;
    if (typeof message === "string" && message) return message;
  }
  if (typeof err === "string" && err) return err;
  return fallback || String(err);
}
