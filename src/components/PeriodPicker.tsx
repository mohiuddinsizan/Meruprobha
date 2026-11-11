"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Input, Modal, cx } from "./ui";
import { todayYmd } from "@/lib/dates";
import { PRESETS, type Preset } from "@/lib/ranges";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** "1 Nov – 11 Nov 2026", "2026", "Nov 2026" or a single day. */
export function rangeText(from: string, to: string) {
  if (!from || !to) return "Everything recorded";
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (from === to) return `${fd} ${MONTHS[fm - 1]} ${fy}`;
  if (fy === ty && fm === 1 && fd === 1 && tm === 12 && td === 31) return String(fy);
  if (fy === ty && fm === tm && fd === 1 && td === lastDay(ty, tm)) return `${MONTHS[fm - 1]} ${fy}`;
  return `${fd} ${MONTHS[fm - 1]}${fy !== ty ? ` ${fy}` : ""} – ${td} ${MONTHS[tm - 1]} ${ty}`;
}

/**
 * Phone-sized period chooser: one button showing the current range, opening a
 * bottom sheet with quick ranges, a month grid, whole years and custom dates.
 */
export function PeriodPicker({
  preset, range, onPreset, onRange, presets, className,
}: {
  preset: Preset;
  range: [string, string];
  onPreset: (p: Preset) => void;
  onRange?: (from: string, to: string) => void;
  presets?: Preset[];
  className?: string;
}) {
  const today = todayYmd();
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(thisYear);
  const [from, setFrom] = useState(range[0]);
  const [to, setTo] = useState(range[1]);

  const list = PRESETS.filter((p) => !presets || presets.includes(p.k));
  const name = PRESETS.find((p) => p.k === preset)?.label ?? "Custom";
  const show = () => {
    setFrom(range[0] || today);
    setTo(range[1] || today);
    setYear(Number((range[0] || today).slice(0, 4)));
    setOpen(true);
  };
  const pick = (p: Preset) => { onPreset(p); setOpen(false); };
  const pickRange = (a: string, b: string) => { onRange?.(a, b); setOpen(false); };
  const isMonth = (m: number) => range[0] === `${year}-${pad(m)}-01` && range[1].slice(0, 7) === `${year}-${pad(m)}`;

  return (
    <>
      <button
        type="button"
        onClick={show}
        className={cx("flex h-12 min-w-0 items-center gap-3 rounded-2xl border border-line bg-white px-3.5 text-left shadow-[0_1px_2px_rgba(26,22,19,0.04)] active:bg-ivory", className)}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold-50 text-gold-600"><CalendarDays className="size-4" /></span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold text-ink">{preset === "custom" ? rangeText(range[0], range[1]) : name}</span>
          <span className="block truncate text-[11px] text-muted">{preset === "custom" ? "Custom period" : rangeText(range[0], range[1])}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-stone-400" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Choose period">
        <div className="space-y-6">
          <section>
            <h4 className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Quick</h4>
            <div className="grid grid-cols-2 gap-2">
              {list.map((p) => (
                <button
                  key={p.k}
                  onClick={() => pick(p.k)}
                  className={cx("h-11 rounded-xl border text-sm font-medium", preset === p.k ? "border-ink bg-ink text-gold-50" : "border-line bg-white text-stone-700 active:bg-ivory")}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          {onRange && (
            <>
              <section>
                <div className="mb-2.5 flex items-center justify-between">
                  <h4 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Month</h4>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setYear(year - 1)} className="grid size-8 place-items-center rounded-full text-stone-500 active:bg-ivory" aria-label="Previous year"><ChevronLeft className="size-4" /></button>
                    <span className="w-12 text-center text-sm font-semibold tabular-nums">{year}</span>
                    <button onClick={() => setYear(year + 1)} disabled={year >= thisYear} className="grid size-8 place-items-center rounded-full text-stone-500 active:bg-ivory disabled:opacity-30" aria-label="Next year"><ChevronRight className="size-4" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {MONTHS.map((m, i) => {
                    const future = year > thisYear || (year === thisYear && i + 1 > thisMonth);
                    return (
                      <button
                        key={m}
                        disabled={future}
                        onClick={() => pickRange(`${year}-${pad(i + 1)}-01`, `${year}-${pad(i + 1)}-${pad(lastDay(year, i + 1))}`)}
                        className={cx("h-10 rounded-xl border text-sm", isMonth(i + 1) ? "border-ink bg-ink font-medium text-gold-50" : "border-line bg-white text-stone-700 active:bg-ivory", future && "opacity-35")}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => pickRange(`${year}-01-01`, `${year}-12-31`)}
                  className="mt-2 h-10 w-full rounded-xl border border-dashed border-gold-300 text-sm font-medium text-gold-700 active:bg-gold-50"
                >
                  Whole year {year}
                </button>
              </section>

              <section>
                <h4 className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Custom dates</h4>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">From</span>
                    <Input type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">To</span>
                    <Input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
                  </label>
                </div>
                <Button className="mt-3 w-full" disabled={!from || !to || from > to} onClick={() => pickRange(from, to)}>Show this period</Button>
              </section>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

/** Round "Filters" button with a count of active filters, for phone toolbars. */
export function FilterButton({ count, onClick, label = "Filters" }: { count: number; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx("relative flex h-12 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-medium shadow-[0_1px_2px_rgba(26,22,19,0.04)]", count ? "border-ink bg-ink text-gold-50" : "border-line bg-white text-stone-700 active:bg-ivory")}
    >
      {label}
      {count > 0 && <span className="grid size-5 place-items-center rounded-full bg-gold-400 text-[11px] font-semibold text-espresso">{count}</span>}
    </button>
  );
}
