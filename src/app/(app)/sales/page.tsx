"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPin, Plus, Search, SlidersHorizontal } from "lucide-react";
import { PeriodPicker } from "@/components/PeriodPicker";
import { Button, Card, Empty, ErrorBox, Input, PageHeader, PaymentBadge, Spinner, StatusBadge, Tabs, cx } from "@/components/ui";
import { useApi } from "@/lib/client";
import { presetRange, type Preset } from "@/lib/ranges";
import { ORDER_STATUSES, STATUS_LABEL } from "@/lib/constants";
import { fmtDate, money } from "@/lib/format";
import type { Order } from "@/lib/types";

type Res = { orders: Order[]; total: number; page: number; limit: number; counts: Record<string, number> };

const itemsText = (o: Order) => o.items.map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ");

export default function SalesPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [preset, setPreset] = useState<Preset>("all");
  const [due, setDue] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(false);
  const params = new URLSearchParams({ status, q, from, to, due: due ? "1" : "", page: String(page), limit: "30" });
  const { data, error } = useApi<Res>(`/api/orders?${params}`, { keepPreviousData: true, revalidateOnMount: true });
  const all = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };
  const activeFilters = [from, to, due].filter(Boolean).length;

  return (
    <>
      <PageHeader eyebrow="Boutique" title="Sales" subtitle="Every order, recorded by hand." actions={<Button href="/sales/new" className="hidden sm:inline-flex"><Plus className="size-4" /> New sale</Button>} />

      <div className="mb-4">
        <Tabs
          value={status}
          onChange={reset(setStatus)}
          tabs={[{ value: "", label: "All", count: all }, ...ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s], count: data?.counts[s] ?? 0 }))]}
        />
      </div>

      <Card className="mb-5">
        <div className="flex flex-col gap-2.5 p-3 sm:p-4 lg:flex-row lg:items-center">
          <div className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gold-500" />
              <Input placeholder="Order #, customer name or phone…" value={q} onChange={(e) => reset(setQ)(e.target.value)} className="pl-10" />
            </div>
            <button
              onClick={() => setFilters((v) => !v)}
              className={cx("relative grid size-10 shrink-0 place-items-center rounded-xl border lg:hidden", filters || activeFilters ? "border-gold-300 bg-gold-50 text-gold-700" : "border-line bg-white text-muted")}
              aria-label="Filters"
            >
              <SlidersHorizontal className="size-4" />
              {activeFilters > 0 && <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-gold-600 text-[10px] text-white">{activeFilters}</span>}
            </button>
          </div>
          <div className={cx("flex-col gap-2.5 sm:flex-row sm:items-center lg:flex", filters ? "flex" : "hidden")}>
            <PeriodPicker
              preset={preset}
              range={[from, to]}
              onPreset={(p) => { const [a, b] = presetRange(p); setPreset(p); setFrom(a); setTo(b); setPage(1); }}
              onRange={(a, b) => { setPreset("custom"); setFrom(a); setTo(b); setPage(1); }}
              className="sm:hidden"
            />
            <div className="hidden items-center gap-2 sm:flex">
              <Input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} aria-label="From date" className="min-w-0" />
              <span className="text-stone-400">–</span>
              <Input type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} aria-label="To date" className="min-w-0" />
            </div>
            <label className="flex items-center gap-2 whitespace-nowrap px-1 text-sm text-muted">
              <input type="checkbox" checked={due} onChange={(e) => reset(setDue)(e.target.checked)} className="size-4 accent-gold-600" /> Pending payment only
            </label>
          </div>
        </div>
      </Card>

      <ErrorBox error={error} />
      {!data && !error && <Spinner />}
      {data?.orders.length === 0 && (
        <Card>
          <Empty title="No sales found">
            <Link href="/sales/new" className="font-medium text-gold-700 underline-offset-4 hover:underline">Record a sale</Link>
          </Empty>
        </Card>
      )}

      {!!data?.orders.length && (
        <>
          {/* Phone: order cards */}
          <ul className="space-y-3 md:hidden">
            {data.orders.map((o) => (
              <li key={o._id}>
                <Link href={`/sales/${o._id}`} className="block rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(26,22,19,0.04)] active:bg-gold-50/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-semibold leading-tight">#{o.orderNo} · {o.customer.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                        {fmtDate(o.saleDate)} · <MapPin className="size-3" /> {o.delivery.city}
                      </p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-2.5 line-clamp-1 text-sm text-stone-600">{itemsText(o)}</p>
                  <div className="mt-3 flex items-end justify-between border-t border-line/70 pt-3">
                    <div className="flex items-center gap-2">
                      <PaymentBadge due={o.due} total={o.total} />
                      <span className="text-xs text-muted">{o.paymentMethod}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{money(o.total)}</p>
                      {o.due > 0 && <p className="text-xs font-medium text-red-600">{money(o.due)} pending</p>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Tablet & desktop: table */}
          <Card className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-[11px] uppercase tracking-[0.14em] text-muted">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">Order</th>
                    <th className="px-3 py-3.5 font-medium">Customer</th>
                    <th className="hidden px-3 py-3.5 font-medium lg:table-cell">Items</th>
                    <th className="px-3 py-3.5 text-right font-medium">Total</th>
                    <th className="px-3 py-3.5 text-right font-medium">Pending</th>
                    <th className="px-3 py-3.5 font-medium">Payment</th>
                    <th className="px-5 py-3.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {data.orders.map((o) => (
                    <tr key={o._id} className="cursor-pointer transition-colors hover:bg-gold-50/40" onClick={() => router.push(`/sales/${o._id}`)}>
                      <td className="px-5 py-3.5">
                        <Link href={`/sales/${o._id}`} className="font-display text-base font-semibold text-ink" onClick={(e) => e.stopPropagation()}>#{o.orderNo}</Link>
                        <p className="text-xs text-muted">{fmtDate(o.saleDate)}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="font-medium">{o.customer.name}</p>
                        <p className="text-xs text-muted">{o.customer.phone} · {o.delivery.city}</p>
                      </td>
                      <td className="hidden max-w-[240px] px-3 py-3.5 text-muted lg:table-cell">
                        <p className="truncate">{itemsText(o)}</p>
                      </td>
                      <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{money(o.total)}</td>
                      <td className={cx("px-3 py-3.5 text-right tabular-nums", o.due > 0 ? "font-medium text-red-600" : "text-stone-300")}>{o.due > 0 ? money(o.due) : "—"}</td>
                      <td className="px-3 py-3.5">
                        <PaymentBadge due={o.due} total={o.total} />
                        <p className="mt-1 text-xs text-muted">{o.paymentMethod}</p>
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {data && pages > 1 && (
        <div className="mt-5 flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">Page {page} of {pages} · {data.total} sales</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </>
  );
}
