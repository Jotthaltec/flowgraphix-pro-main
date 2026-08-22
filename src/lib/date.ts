const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Datas SQL `date` não representam UTC; meio-dia evita recuo de fuso. */
export function parseCivilDate(value: string | Date): Date {
  if (typeof value === "string" && CIVIL_DATE.test(value)) {
    return new Date(`${value}T12:00:00-03:00`);
  }
  return value instanceof Date ? value : new Date(value);
}

export function formatCivilDate(value: string | Date): string {
  const date = parseCivilDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function isCivilDatePast(value: string): boolean {
  const target = parseCivilDate(value);
  if (Number.isNaN(target.getTime())) return false;
  target.setHours(23, 59, 59, 999);
  return target.getTime() < Date.now();
}

export function civilDateFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
