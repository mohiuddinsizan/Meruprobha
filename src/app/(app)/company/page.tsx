"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, CalendarCheck, Landmark, PieChart } from "lucide-react";
import { LedgerItem } from "@/components/LedgerItem";
import { Avatar, DistributeModal } from "@/components/MoneyForms";
import { Button, Card, Empty, ErrorBox, PageHeader, Spinner, Stat, cx } from "@/components/ui";
import { useApi } from "@/lib/client";
import { fmtDate, money } from "@/lib/format";
import type { Account, DistributionPreview, LedgerEntry } from "@/lib/types";

type Company = DistributionPreview & {
  balance: number;
  pendingPayments: number;
  accounts: Account[];
  lastShares: { user: string; pct: number }[];
  lastAt: string | null;
  distributions: number;
};

export default function CompanyPage() {
  const [distributing, setDistributing] = useState(false);
  const { data: c, error, mutate } = useApi<Company>("/api/company", { revalidateOnMount: true });
  const { data: recent, mutate: mutateRecent } = useApi<{ entries: LedgerEntry[] }>("/api/ledger?type=distribution", { revalidateOnMount: true });
  const ymd = (v: string) => fmtDate(v + "T06:00:00Z");

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Company account"
        subtitle="All profit stays here until it's distributed to the partners' accounts."
        actions={<Button onClick={() => setDistributing(true)} disabled={!c}><PieChart className="size-4" /> Distribute profit</Button>}
      />

      <ErrorBox error={error} />
      {!c && !error && <Spinner />}
      {c && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <div className="col-span-2 lg:col-span-1">
              <Stat
                icon={Landmark}
                label="In company account"
                value={<span className={c.balance < 0 ? "text-red-300" : ""}>{money(c.balance)}</span>}
                sub="undistributed profit up to today"
                emphasis
              />
            </div>
            <Stat icon={CalendarCheck} label="Distributed up to" value={c.lastUpTo ? ymd(c.lastUpTo) : "—"} sub={c.lastAt ? `on ${fmtDate(c.lastAt)}` : "nothing distributed yet"} />
            <Stat icon={PieChart} label="Distributed so far" value={money(c.alreadyDistributed)} sub={`in ${c.distributions} distribution${c.distributions === 1 ? "" : "s"}`} />
          </div>

          <Card className="overflow-hidden">
            <div className="grid grid-cols-1 divide-y divide-line/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                { k: "Net profit to date", v: money(c.profit.net), sub: `${money(c.profit.gross)} gross − ${money(c.profit.expenses)} expenses`, op: "" },
                { k: "Already distributed", v: money(c.alreadyDistributed), op: "−" },
                { k: "In company account", v: money(c.balance), op: "=" },
              ].map((x, i) => (
                <div key={x.k} className={cx("flex items-center justify-between gap-3 px-5 py-3.5 sm:block", i === 2 && "bg-gold-50/60")}>
                  <div>
                    <p className="text-xs text-muted">{x.op && <span className="mr-1 font-semibold text-gold-600">{x.op}</span>}{x.k}</p>
                    {x.sub && <p className="hidden text-[11px] text-stone-400 sm:block">{x.sub}</p>}
                  </div>
                  <p className={cx("font-semibold tabular-nums sm:mt-1 sm:text-lg", i === 2 && (c.balance < 0 ? "text-red-600" : "text-emerald-700"))}>{x.v}</p>
                </div>
              ))}
            </div>
          </Card>

          {c.balance < 0 && (
            <p className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              More was distributed than the profit now shows, usually because a sale was cancelled or an expense was added for an already distributed period. The next distribution will be smaller to balance it.
            </p>
          )}
          {c.pendingPayments > 0 && (
            <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>Customers still owe <b>{money(c.pendingPayments)}</b>. Profit counts every sale that isn&apos;t cancelled, including unpaid ones. <Link href="/sales" className="font-medium underline-offset-4 hover:underline">See sales</Link></span>
            </p>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Card title="Partner balances" className="min-w-0 lg:col-span-2" action={<Link href="/partners" className="text-xs font-medium text-gold-700 hover:underline">All partners →</Link>}>
              <ul className="divide-y divide-line/70">
                {c.accounts.map((a) => (
                  <li key={a._id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <Avatar name={a.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted">received {money(a.totalReceived)}</p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{money(a.balance)}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Recent distributions" className="min-w-0 lg:col-span-3" action={<Link href="/log" className="text-xs font-medium text-gold-700 hover:underline">Full log →</Link>}>
              {!recent ? (
                <Spinner />
              ) : recent.entries.length === 0 ? (
                <Empty title="No distributions yet">
                  <button onClick={() => setDistributing(true)} className="font-medium text-gold-700 underline-offset-4 hover:underline">Distribute profit</button>
                </Empty>
              ) : (
                <ul className="divide-y divide-line/70">
                  {recent.entries.slice(0, 3).map((e) => <LedgerItem key={e._id} e={e} />)}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {distributing && c && (
        <DistributeModal
          accounts={c.accounts}
          lastShares={c.lastShares}
          lastUpTo={c.lastUpTo}
          onClose={() => setDistributing(false)}
          onDone={() => { mutate(); mutateRecent(); }}
        />
      )}
    </>
  );
}
