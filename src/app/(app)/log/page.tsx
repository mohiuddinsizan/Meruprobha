"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LedgerItem } from "@/components/LedgerItem";
import { Button, Card, Empty, ErrorBox, PageHeader, Select, Spinner, Tabs, cx, useConfirm, useToast } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { money } from "@/lib/format";
import { useMe } from "@/lib/me";
import type { Account, LedgerEntry } from "@/lib/types";

type Res = { entries: LedgerEntry[]; total: number; page: number; limit: number; latestDistribution: string | null };

export default function LogPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Log />
    </Suspense>
  );
}

function Log() {
  const sp = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const me = useMe();
  const [type, setType] = useState("");
  const [user, setUser] = useState(sp.get("user") ?? "");
  const [page, setPage] = useState(1);
  const { data: users } = useApi<Account[]>("/api/users");
  const { data, error, mutate, isLoading } = useApi<Res>(`/api/ledger?${new URLSearchParams({ type, user, page: String(page) })}`, { keepPreviousData: true, revalidateOnMount: true });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const canReverse = (e: LedgerEntry) => me?.role === "super" && !e.reversed && (e.type === "withdrawal" || e._id === data?.latestDistribution);
  const reverse = async (e: LedgerEntry) => {
    const what = e.type === "distribution" ? `the distribution of ${money(e.distributed)}` : `${e.userName}'s withdrawal of ${money(e.amount)}`;
    const msg = e.type === "distribution"
      ? "The money goes back from each partner's account to the company account. It stays in the log, marked as reversed."
      : "The money goes back into their account. It stays in the log, marked as reversed.";
    if (!(await confirm({ title: `Reverse ${what}?`, message: msg, confirmText: "Reverse", danger: true }))) return;
    try {
      await api(`/api/ledger/${e._id}/reverse`, "POST");
      toast("Reversed");
      mutate();
    } catch (x) {
      toast((x as Error).message, "err");
    }
  };

  return (
    <>
      <PageHeader eyebrow="Money" title="Log" subtitle="Every profit distribution and withdrawal: who, how much and when. Everyone can see this." />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={type}
          onChange={(v) => { setType(v); setPage(1); }}
          tabs={[{ value: "", label: "All" }, { value: "distribution", label: "Distributions" }, { value: "withdrawal", label: "Withdrawals" }]}
        />
        <Select value={user} onChange={(e) => { setUser(e.target.value); setPage(1); }} aria-label="Partner" className="sm:w-56">
          <option value="">Everyone</option>
          {users?.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
        </Select>
      </div>

      <ErrorBox error={error} />
      {!data && !error && <Spinner />}
      {data && (
        <Card className={cx("transition-opacity", isLoading && "opacity-60")}>
          {data.entries.length === 0 ? (
            <Empty title="Nothing recorded yet">Distributions and withdrawals will appear here.</Empty>
          ) : (
            <ul className="divide-y divide-line/70">
              {data.entries.map((e) => <LedgerItem key={e._id} e={e} onReverse={canReverse(e) ? reverse : undefined} />)}
            </ul>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-line/70 px-4 py-3 text-sm sm:px-5">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</Button>
              <span className="text-muted">Page {page} of {pages}</span>
              <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Older</Button>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
