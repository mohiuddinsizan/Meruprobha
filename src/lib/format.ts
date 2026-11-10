export function money(n: number | null | undefined): string {
  const v = Math.round((n ?? 0) * 100) / 100;
  return (v < 0 ? "-৳" : "৳") + Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function num(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-IN");
}

export function fmtDate(d: string | Date | null | undefined, withTime = false): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: true } : {}),
  });
}
