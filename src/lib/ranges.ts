import { addDays, todayYmd } from "./dates";

export type Preset = "today" | "yesterday" | "7d" | "30d" | "month" | "lastmonth" | "year" | "lastyear" | "all" | "custom";

export function presetRange(p: Preset): [string, string] {
  const t = todayYmd();
  const y = Number(t.slice(0, 4));
  const m = Number(t.slice(5, 7));
  switch (p) {
    case "today": return [t, t];
    case "yesterday": return [addDays(t, -1), addDays(t, -1)];
    case "7d": return [addDays(t, -6), t];
    case "30d": return [addDays(t, -29), t];
    case "month": return [t.slice(0, 8) + "01", t];
    case "lastmonth": {
      const first = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}-01`;
      return [first, addDays(t.slice(0, 8) + "01", -1)];
    }
    case "year": return [`${y}-01-01`, t];
    case "lastyear": return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    default: return ["", ""];
  }
}

export const PRESETS: { k: Preset; label: string }[] = [
  { k: "today", label: "Today" },
  { k: "yesterday", label: "Yesterday" },
  { k: "7d", label: "Last 7 days" },
  { k: "30d", label: "Last 30 days" },
  { k: "month", label: "This month" },
  { k: "lastmonth", label: "Last month" },
  { k: "year", label: "This year" },
  { k: "lastyear", label: "Last year" },
  { k: "all", label: "All time" },
];
