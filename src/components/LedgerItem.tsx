"use client";

import { ArrowDownToLine, PieChart, Undo2 } from "lucide-react";
import { cx } from "./ui";
import { fmtDate, money } from "@/lib/format";
import type { LedgerEntry } from "@/lib/types";

/** One distribution or withdrawal in the money log. */
export function LedgerItem({ e, onReverse }: { e: LedgerEntry; onReverse?: (e: LedgerEntry) => void }) {
  const dist = e.type === "distribution";
  const Icon = dist ? PieChart : ArrowDownToLine;
  return (
    <li className={cx("px-4 py-4 sm:px-5", e.reversed && "bg-stone-50/70")}>
      <div className="flex items-start gap-3">
        <span className={cx("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full", dist ? "bg-gold-50 text-gold-600 ring-1 ring-gold-100" : "bg-stone-100 text-stone-600")}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <p className={cx("font-medium", e.reversed && "text-stone-400 line-through")}>
              {dist ? <>Profit distributed up to {fmtDate(e.upTo!)}</> : <>{e.userName} withdrew {money(e.amount)}</>}
            </p>
            <span className={cx("shrink-0 font-semibold tabular-nums", e.reversed ? "text-stone-400 line-through" : dist ? "text-emerald-700" : "text-ink")}>
              {dist ? money(e.distributed) : `− ${money(e.amount)}`}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {fmtDate(e.createdAt, true)} · by {e.byName}
            {!dist && e.byName !== e.userName && " (recorded for them)"}
          </p>
          {e.note && <p className="mt-1.5 text-sm text-stone-600">{e.note}</p>}

          {dist && (
            <div className="mt-3 overflow-hidden rounded-xl border border-line/80">
              <ul className="divide-y divide-line/70 text-sm">
                {e.shares.map((s) => (
                  <li key={s.user} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate">{s.name}</span>
                    <span className="flex shrink-0 items-center gap-2 tabular-nums sm:gap-3">
                      <span className="text-right text-xs text-muted sm:w-14">{s.pct}%</span>
                      <span className="min-w-[4.5rem] text-right font-medium sm:w-24">{money(s.amount)}</span>
                    </span>
                  </li>
                ))}
                {e.retained > 0 && (
                  <li className="flex items-center justify-between gap-3 bg-ivory/60 px-3 py-2 text-muted">
                    <span>Stayed in company account</span>
                    <span className="text-right tabular-nums sm:w-24">{money(e.retained)}</span>
                  </li>
                )}
              </ul>
              <p className="border-t border-line/70 bg-ivory/40 px-3 py-1.5 text-[11px] text-muted">
                {money(e.available)} available = {money(e.profitToDate)} net profit to date − {money(e.alreadyDistributed)} distributed before
              </p>
            </div>
          )}

          {(e.reversed || onReverse) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {e.reversed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200"><Undo2 className="size-3 shrink-0" /> Reversed by {e.reversed.byName} · {fmtDate(e.reversed.at, true)}</span>
              ) : (
                <button onClick={() => onReverse?.(e)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                  <Undo2 className="size-3.5" /> Reverse
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
