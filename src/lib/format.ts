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

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? " " + ONES[r % 10] : ""}`;
  return [h ? `${ONES[h]} Hundred` : "", rest].filter(Boolean).join(" ");
}

/** Amount in words, Bangladeshi style (lakh/crore): 12500.5 → "Twelve Thousand Five Hundred Taka and Fifty Paisa Only". */
export function takaInWords(amount: number): string {
  const v = Math.round(Math.abs(amount) * 100);
  let n = Math.floor(v / 100);
  const paisa = v % 100;
  if (n === 0 && paisa === 0) return "Zero Taka Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  if (crore) parts.push(`${crore >= 1000 ? takaInWords(crore).replace(/ Taka Only$/, "") : below1000(crore)} Crore`);
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  if (lakh) parts.push(`${below1000(lakh)} Lakh`);
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (thousand) parts.push(`${below1000(thousand)} Thousand`);
  if (n) parts.push(below1000(n));
  const taka = parts.join(" ");
  return `${taka ? taka + " Taka" : ""}${paisa ? `${taka ? " and " : ""}${below1000(paisa)} Paisa` : ""} Only`;
}
