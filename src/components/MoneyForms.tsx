"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Equal } from "lucide-react";
import { Button, ErrorBox, Field, Input, Modal, Spinner, Textarea, cx, useConfirm, useToast } from "./ui";
import { api, useApi } from "@/lib/client";
import { addDays, todayYmd } from "@/lib/dates";
import { fmtDate, money } from "@/lib/format";
import type { Account, DistributionPreview } from "@/lib/types";

const r2 = (v: number) => Math.round(v * 100) / 100;
const ymdLabel = (ymd: string) => fmtDate(ymd + "T06:00:00Z");

export function Avatar({ name, className }: { name: string; className?: string }) {
  return <span className={cx("grid size-9 shrink-0 place-items-center rounded-full bg-ink font-display text-base font-semibold text-gold-300", className)}>{name.charAt(0).toUpperCase()}</span>;
}

/** Two steps: pick the cut-off date, then each partner's percentage. Mount it only while open. */
export function DistributeModal({
  onClose, accounts, lastShares, lastUpTo, onDone,
}: {
  onClose: () => void;
  accounts: Account[];
  lastShares: { user: string; pct: number }[];
  lastUpTo: string | null;
  onDone: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const today = todayYmd();
  const [step, setStep] = useState<1 | 2>(1);
  const [upTo, setUpTo] = useState(today);
  // Starts from last time's percentages, for partners who are still active.
  const [pcts, setPcts] = useState<Record<string, string>>(() =>
    Object.fromEntries(lastShares.filter((s) => accounts.some((a) => a._id === s.user)).map((s) => [s.user, String(s.pct)]))
  );
  const [note, setNote] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const { data: pv, error: pvErr, isLoading } = useApi<DistributionPreview>(upTo ? `/api/company/preview?upTo=${upTo}` : null, { keepPreviousData: true });

  const lastMonthEnd = addDays(today.slice(0, 8) + "01", -1);
  const tooEarly = !!lastUpTo && upTo < lastUpTo;
  const available = pv?.available ?? 0;
  const rows = accounts.map((a) => {
    const pct = Number(pcts[a._id]) || 0;
    return { a, pct, amount: r2((available * pct) / 100) };
  });
  const totalPct = r2(rows.reduce((t, r) => t + r.pct, 0));
  const toPartners = r2(rows.reduce((t, r) => t + r.amount, 0));
  const stays = r2(available - toPartners);
  const over = totalPct > 100;

  const close = onClose;
  const equal = () => {
    const n = accounts.length;
    const each = Math.floor((100 / n) * 100) / 100;
    setPcts(Object.fromEntries(accounts.map((a, i) => [a._id, String(i === n - 1 ? r2(100 - each * (n - 1)) : each)])));
  };

  const submit = async () => {
    setErr(null);
    const shares = rows.filter((r) => r.pct > 0).map((r) => ({ user: r.a._id, pct: r.pct }));
    if (!shares.length) return setErr("Give at least one partner a percentage");
    const ok = await confirm({
      title: `Distribute ${money(toPartners)}?`,
      message: (
        <>
          Profit up to <b>{ymdLabel(upTo)}</b> goes to {shares.length} partner{shares.length > 1 ? "s" : ""}
          {stays > 0 && <>, and {money(stays)} stays in the company account</>}. This is recorded in the log for everyone to see.
        </>
      ),
      confirmText: "Distribute",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await api("/api/distributions", "POST", { upTo, shares, note, expectedAvailable: available });
      toast(`${money(toPartners)} distributed`);
      onDone();
      close();
    } catch (e) {
      setErr(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={close} title="Distribute profit" wide>
      <ol className="mb-5 flex items-center gap-2 text-xs font-medium">
        {["Up to when", "Percentages"].map((t, i) => (
          <li key={t} className={cx("flex items-center gap-2", step === i + 1 ? "text-ink" : "text-stone-400")}>
            <span className={cx("grid size-6 place-items-center rounded-full", step === i + 1 ? "bg-ink text-gold-50" : "bg-ivory text-stone-500")}>{i + 1}</span>
            {t}
            {i === 0 && <span className="mx-1 h-px w-6 bg-line" />}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="space-y-5">
          <Field label="Distribute profit earned up to" hint={lastUpTo ? `Last distribution covered up to ${ymdLabel(lastUpTo)}` : "No profit has been distributed yet"}>
            <Input type="date" value={upTo} min={lastUpTo ?? undefined} max={today} onChange={(e) => setUpTo(e.target.value)} required />
          </Field>
          <div className="flex flex-wrap gap-2">
            {[["Today", today], ["End of last month", lastMonthEnd]].map(([l, v]) => (
              <button key={l} type="button" disabled={!!lastUpTo && v < lastUpTo} onClick={() => setUpTo(v)} className={cx("h-9 rounded-full border px-4 text-sm font-medium disabled:opacity-40", upTo === v ? "border-ink bg-ink text-gold-50" : "border-line bg-white text-stone-600")}>
                {l}
              </button>
            ))}
          </div>

          {tooEarly ? (
            <ErrorBox error={`Profit up to ${ymdLabel(lastUpTo!)} is already distributed. Choose that date or later.`} />
          ) : pvErr ? (
            <ErrorBox error={pvErr} />
          ) : !pv ? (
            <Spinner />
          ) : (
            <dl className={cx("divide-y divide-line/70 rounded-xl border border-line text-sm transition-opacity", isLoading && "opacity-60")}>
              <Line k={`Net profit up to ${ymdLabel(upTo)}`} v={money(pv.profit.net)} sub={`${money(pv.profit.gross)} gross profit − ${money(pv.profit.expenses)} expenses`} />
              <Line k="Already distributed" v={`− ${money(pv.alreadyDistributed)}`} />
              <Line k="Available to distribute" v={money(pv.available)} strong tone={pv.available > 0 ? "good" : "bad"} />
            </dl>
          )}
          {pv && pv.available <= 0 && !tooEarly && <p className="text-sm text-muted">There&apos;s no undistributed profit up to this date.</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button disabled={!pv || tooEarly || pv.available <= 0 || isLoading} onClick={() => setStep(2)}>
              Next <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gold-50/70 px-4 py-3 text-sm">
            <span className="text-muted">Available up to {ymdLabel(upTo)}</span>
            <span className="font-semibold tabular-nums text-emerald-700">{money(available)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={equal}><Equal className="size-3.5" /> Split equally</Button>
            {lastShares.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setPcts(Object.fromEntries(lastShares.map((s) => [s.user, String(s.pct)])))}>Same as last time</Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setPcts({})}>Clear</Button>
          </div>

          <ul className="divide-y divide-line/70 rounded-xl border border-line">
            {rows.map(({ a, amount }) => (
              <li key={a._id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <Avatar name={a.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-xs tabular-nums text-muted">{money(amount)}</p>
                </div>
                <div className="relative w-24 shrink-0">
                  <Input
                    type="number" min={0} max={100} step="0.01" inputMode="decimal"
                    value={pcts[a._id] ?? ""} placeholder="0"
                    onChange={(e) => setPcts({ ...pcts, [a._id]: e.target.value })}
                    className="pr-7 text-right tabular-nums" aria-label={`${a.name} percentage`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">%</span>
                </div>
              </li>
            ))}
          </ul>

          <dl className="divide-y divide-line/70 rounded-xl border border-line text-sm">
            <Line k="Total percentage" v={`${totalPct}%`} tone={over ? "bad" : undefined} strong={over} />
            <Line k="To partners' accounts" v={money(toPartners)} strong />
            <Line k="Stays in company account" v={money(Math.max(stays, 0))} />
          </dl>
          {over && <ErrorBox error={`Percentages add up to ${totalPct}%. They can't be more than 100%.`} />}

          <Field label="Note">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. October profit" maxLength={300} />
          </Field>
          <ErrorBox error={err} />
          <div className="flex justify-between gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}><ArrowLeft className="size-4" /> Back</Button>
            <Button loading={saving} disabled={over || totalPct <= 0} onClick={submit}>Distribute {money(toPartners)}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Line({ k, v, sub, strong, tone }: { k: string; v: string; sub?: string; strong?: boolean; tone?: "good" | "bad" }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-2.5">
      <div>
        <dt className={cx(strong ? "font-medium text-ink" : "text-muted")}>{k}</dt>
        {sub && <dd className="text-xs text-stone-400">{sub}</dd>}
      </div>
      <dd className={cx("shrink-0 tabular-nums", strong && "font-semibold", tone === "good" && "text-emerald-700", tone === "bad" && "text-red-600")}>{v}</dd>
    </div>
  );
}

export function WithdrawModal({ account, self, onClose, onDone }: { account: Account | null; self: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const close = () => { setAmount(""); setNote(""); setErr(null); onClose(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    const amt = Number(amount);
    setErr(null);
    if (!(amt > 0)) return setErr("Enter an amount");
    if (amt > account.balance) return setErr(`Only ${money(account.balance)} is available`);
    if (!(await confirm({ title: `Withdraw ${money(amt)}?`, message: `From ${self ? "your" : `${account.name}'s`} account. It's recorded in the log.`, confirmText: "Withdraw" }))) return;
    setSaving(true);
    try {
      await api("/api/withdrawals", "POST", { user: account._id, amount: amt, note });
      toast(`${money(amt)} withdrawn`);
      onDone();
      close();
    } catch (x) {
      setErr(x);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!account} onClose={close} title={self ? "Withdraw from my account" : `Withdraw for ${account?.name ?? ""}`}>
      {account && (
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-gold-50/70 px-4 py-3 text-sm">
            <span className="text-muted">Available balance</span>
            <span className="font-semibold tabular-nums">{money(account.balance)}</span>
          </div>
          <Field label="Amount (৳)" required>
            <div className="flex gap-2">
              <Input type="number" min={0.01} max={account.balance} step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
              <Button type="button" variant="secondary" onClick={() => setAmount(String(account.balance))}>All</Button>
            </div>
          </Field>
          <Field label="Note">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Sent to bKash 01XXXXXXXXX" maxLength={300} />
          </Field>
          <ErrorBox error={err} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={account.balance <= 0}>Withdraw</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
