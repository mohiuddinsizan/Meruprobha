"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { Card, cx } from "./ui";
import { money } from "@/lib/format";
import type { Partner } from "@/lib/types";

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Splits a period's net profit by each partner's current share. */
export function splitProfit(netProfit: number, partners: Partner[]) {
  const rows = partners.map((p) => ({ ...p, amount: r2((netProfit * p.sharePct) / 100) }));
  const assignedPct = r2(partners.reduce((s, p) => s + p.sharePct, 0));
  const retained = r2(netProfit - rows.reduce((s, p) => s + p.amount, 0));
  return { rows, assignedPct, retained };
}

export function PartnerShares({ netProfit, partners, title = "Profit distribution", manage = true }: { netProfit: number; partners?: Partner[]; title?: string; manage?: boolean }) {
  const action = manage ? <Link href="/partners" className="no-print text-xs font-medium text-gold-700 hover:underline">Manage partners →</Link> : undefined;
  if (!partners) return null;
  if (partners.length === 0) {
    return (
      <Card title={title} action={action}>
        <div className="flex items-center gap-3 px-5 py-6 text-sm text-muted">
          <Users className="size-5 shrink-0 text-gold-500" />
          <p>
            No partners yet. <Link href="/partners" className="font-medium text-gold-700 hover:underline">Add partners</Link> with their share % to see how much each one receives from this profit.
          </p>
        </div>
      </Card>
    );
  }

  const { rows, assignedPct, retained } = splitProfit(netProfit, partners);
  const loss = netProfit < 0;
  return (
    <Card title={title} action={action}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line/70 bg-gold-50/50 px-5 py-3 text-sm">
        <span className="text-muted">{loss ? "Net loss to share" : "Net profit to share"}</span>
        <span className={cx("font-semibold tabular-nums", loss ? "text-red-600" : "text-emerald-700")}>{money(netProfit)}</span>
      </div>
      <ul className="divide-y divide-line/70">
        {rows.map((p) => (
          <li key={p._id} className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink font-display text-base font-semibold text-gold-300">{p.name.charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-xs text-muted">{+p.sharePct.toFixed(2)}% share</p>
              </div>
              <span className={cx("shrink-0 text-lg font-semibold tabular-nums", p.amount < 0 && "text-red-600")}>{money(p.amount)}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-ivory">
              <div className="h-1.5 rounded-full bg-series-1" style={{ width: `${Math.min(Math.max(p.sharePct, 1), 100)}%` }} />
            </div>
          </li>
        ))}
        {assignedPct < 100 && (
          <li className="flex items-center gap-3 px-5 py-3.5 text-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-gold-300 text-xs text-gold-600">{+(100 - assignedPct).toFixed(2)}%</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-stone-600">Not assigned</p>
              <p className="text-xs text-muted">stays with the shop</p>
            </div>
            <span className={cx("shrink-0 font-semibold tabular-nums text-stone-600", retained < 0 && "text-red-600")}>{money(retained)}</span>
          </li>
        )}
      </ul>
      <p className="border-t border-line/70 px-5 py-2.5 text-xs text-muted">
        Uses each partner&apos;s current share %. {loss && "This period made a loss, so the amounts show each partner's share of it."}
      </p>
    </Card>
  );
}
