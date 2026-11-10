// Bangladesh is UTC+6 with no daylight saving, so day boundaries are a fixed offset.
export const TZ = "Asia/Dhaka";
const OFFSET = 6 * 3600 * 1000;

export function todayYmd(): string {
  return new Date(Date.now() + OFFSET).toISOString().slice(0, 10);
}

export function toYmd(d: Date | string): string {
  return new Date(new Date(d).getTime() + OFFSET).toISOString().slice(0, 10);
}

/** Start of the given Dhaka calendar day as a UTC instant. */
export function dayStart(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - OFFSET);
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Sale date for a picked calendar day: now if it's today, otherwise noon of that day. */
export function saleDateFromYmd(ymd: string): Date {
  if (ymd === todayYmd()) return new Date();
  return new Date(dayStart(ymd).getTime() + 12 * 3600 * 1000);
}

export function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
