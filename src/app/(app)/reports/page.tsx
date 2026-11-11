"use client";

import Link from "next/link";
import { useState } from "react";
import { Ban, Coins, Download, Filter, Package, Printer, Receipt, Sparkles, Table2, TrendingUp, Truck, Wallet, X } from "lucide-react";
import { CategoryProfit, GenreProfit, Insights, ProductProfitability, UnsoldStock, type CategoryRow, type GenreRow, type ProductRow, type UnsoldRow } from "@/components/ProfitAnalysis";
import { FilterButton, PeriodPicker } from "@/components/PeriodPicker";
import { SalesChart, bucketLabel } from "@/components/SalesChart";
import { Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Stat, cx } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { STATUS_LABEL, type OrderStatus } from "@/lib/constants";
import { todayYmd } from "@/lib/dates";
import { PRESETS, presetRange, type Preset } from "@/lib/ranges";
import { fmtDate, money, num } from "@/lib/format";
import type { Genre, Order } from "@/lib/types";

type Report = {
  from: string;
  to: string;
  granularity: "day" | "month" | "year";
  summary: {
    expenses: number; netProfit: number; netMargin: number;
    orders: number; itemsSold: number; gross: number; discount: number; net: number; cost: number; profit: number; margin: number; avgOrder: number;
    deliveryCharge: number; deliveryCollected: number; deliveryNotCollected: number; billed: number; received: number; due: number;
    cancelledOrders: number; cancelledValue: number;
  };
  timeline: { bucket: string; sales: number; profit: number; orders: number; expenses: number; netProfit: number }[];
  expensesByCategory: { _id: string; name: string; total: number; count: number }[];
  statusCounts: Record<string, number>;
  scoped: boolean;
  byGenre: GenreRow[];
  byCategory: CategoryRow[];
  byProduct: ProductRow[];
  unsold: UnsoldRow[];
  byPayment: { method: string; orders: number; billed: number; received: number }[];
  byCity: { city: string; orders: number; net: number }[];
  bySource: { source: string; orders: number; net: number }[];
};

export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("month");
  const [range, setRange] = useState<[string, string]>(presetRange("month"));
  const [delivered, setDelivered] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [genre, setGenre] = useState("");
  const [category, setCategory] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data: genres } = useApi<Genre[]>("/api/categories");
  const g = genres?.find((x) => x._id === genre);
  const scopeName = g ? `${g.name}${category ? ` › ${g.categories.find((c) => c._id === category)?.name ?? ""}` : ""}` : "";
  const focus = (gid: string, cid: string | null = null) => {
    setGenre(gid);
    setCategory(cid ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const params = new URLSearchParams({ from: range[0], to: range[1], delivered: delivered ? "1" : "", genre, category });
  const { data: r, error, isLoading } = useApi<Report>(`/api/reports?${params}`, { keepPreviousData: true });

  const choose = (p: Preset) => {
    setPreset(p);
    setRange(presetRange(p));
  };
  const custom = (from: string, to: string) => {
    setPreset("custom");
    setRange([from, to]);
  };
  const thisYear = Number(todayYmd().slice(0, 4));

  const exportCsv = async () => {
    if (!r) return;
    setExporting(true);
    try {
      const q = new URLSearchParams({ from: r.from, to: r.to, limit: "5000" });
      const { orders } = await api<{ orders: Order[] }>(`/api/orders?${q}`);
      const rows = [["Order", "Date", "Status", "Customer", "Phone", "City", "Items", "Qty", "Products total", "Discount", "Sold for", "Buying cost", "Profit", "Delivery charge", "Delivery collected", "Customer pays", "Paid", "Pending", "Payment type", "Source"]];
      for (const o of orders) {
        const cost = o.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
        const net = o.subtotal - o.discount;
        rows.push([
          String(o.orderNo), fmtDate(o.saleDate), STATUS_LABEL[o.status as OrderStatus] ?? o.status, o.customer.name, o.customer.phone, o.delivery.city,
          o.items.map((i) => `${i.name} x${i.quantity} @${i.unitPrice}`).join("; "), String(o.items.reduce((s, i) => s + i.quantity, 0)),
          String(o.subtotal), String(o.discount), String(net), String(cost), String(net - cost), String(o.deliveryCharge),
          o.deliveryChargeCollected ? "Yes" : "No", String(o.total), String(o.amountPaid), String(o.due), o.paymentMethod, o.source,
        ]);
      }
      const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
      a.download = `sales_${r.from}_to_${r.to}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
  };

  const s = r?.summary;
  const label = r ? (r.from === r.to ? fmtDate(r.from + "T06:00:00Z") : `${fmtDate(r.from + "T06:00:00Z")} – ${fmtDate(r.to + "T06:00:00Z")}`) : "";

  return (
    <>
      <PageHeader
        eyebrow="Overview" title="Sales report"
        subtitle={label ? `${label}${scopeName ? ` · ${scopeName} only` : ""}${delivered ? " · delivered orders only" : " · all orders except cancelled"}` : " "}
        actions={
          <div className="no-print flex gap-2">
            <Button variant="secondary" onClick={() => window.print()} className="hidden sm:inline-flex"><Printer className="size-4" /> Print</Button>
            <Button variant="secondary" loading={exporting} onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>
          </div>
        }
      />

      <div className="no-print mb-5 flex gap-2 sm:hidden">
        <PeriodPicker preset={preset} range={range} onPreset={choose} onRange={custom} className="flex-1" />
        <FilterButton count={(genre ? 1 : 0) + (category ? 1 : 0) + (delivered ? 1 : 0)} onClick={() => setFiltersOpen(true)} />
      </div>

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <div className="space-y-4">
          <Field label="Genre">
            <Select value={genre} onChange={(e) => { setGenre(e.target.value); setCategory(""); }}>
              <option value="">All genres</option>
              {genres?.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)} disabled={!g?.categories.length}>
              <option value="">All categories</option>
              {g?.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm">
            <span>
              <span className="block font-medium">Delivered orders only</span>
              <span className="block text-xs text-muted">Leave off to count every order except cancelled</span>
            </span>
            <input type="checkbox" checked={delivered} onChange={(e) => setDelivered(e.target.checked)} className="size-5 shrink-0 accent-gold-600" />
          </label>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => { setGenre(""); setCategory(""); setDelivered(false); }}>Reset</Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>

      <Card className="no-print mb-6 hidden sm:block">
        <div className="space-y-3 p-4">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {PRESETS.map((p) => (
              <button
                key={p.k}
                onClick={() => choose(p.k)}
                className={cx("h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors", preset === p.k ? "border-ink bg-ink text-gold-50" : "border-line bg-white text-stone-600 hover:border-gold-300")}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
            <label className="flex w-full items-center gap-2 sm:w-auto">
              <span className="text-stone-500">From</span>
              <Input type="date" value={range[0]} onChange={(e) => custom(e.target.value, range[1] || todayYmd())} className="min-w-0 sm:w-auto" />
              <span className="text-stone-500">to</span>
              <Input type="date" value={range[1]} onChange={(e) => custom(range[0] || e.target.value, e.target.value)} className="min-w-0 sm:w-auto" />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-stone-500">Month</span>
              <Input
                type="month"
                className="w-auto"
                value={preset === "custom" && range[0].slice(0, 7) === range[1].slice(0, 7) && range[0].endsWith("-01") ? range[0].slice(0, 7) : ""}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [y, m] = e.target.value.split("-").map(Number);
                  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
                  custom(`${e.target.value}-01`, `${e.target.value}-${String(last).padStart(2, "0")}`);
                }}
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-stone-500">Year</span>
              <Select
                className="w-auto"
                value={preset === "custom" && range[0].endsWith("-01-01") && range[1].endsWith("-12-31") && range[0].slice(0, 4) === range[1].slice(0, 4) ? range[0].slice(0, 4) : ""}
                onChange={(e) => e.target.value && custom(`${e.target.value}-01-01`, `${e.target.value}-12-31`)}
              >
                <option value="">Pick</option>
                {Array.from({ length: 6 }, (_, i) => thisYear - i).map((y) => <option key={y}>{y}</option>)}
              </Select>
            </label>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Filter className="size-4 shrink-0 text-gold-500" />
              <Select value={genre} onChange={(e) => focus(e.target.value)} aria-label="Genre" className="min-w-0 sm:w-40">
                <option value="">All genres</option>
                {genres?.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
              </Select>
              <Select value={category} onChange={(e) => focus(genre, e.target.value || null)} disabled={!g?.categories.length} aria-label="Category" className="min-w-0 sm:w-40">
                <option value="">All categories</option>
                {g?.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </Select>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={delivered} onChange={(e) => setDelivered(e.target.checked)} className="size-4 accent-gold-600" />
              Delivered orders only
            </label>
          </div>
        </div>
      </Card>

      <ErrorBox error={error} />
      {!r && isLoading && <Spinner />}
      {r && s && (
        <div className={cx("space-y-6 transition-opacity", isLoading && "opacity-60")}>
          {r.scoped && (
            <div className="flex flex-col gap-3 rounded-2xl border border-gold-200 bg-gold-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gold-700">
                Showing only <b>{scopeName}</b>. Profit here is sales − buying cost for these items; shop-wide expenses aren&apos;t split by genre.
              </p>
              <button onClick={() => focus("")} className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-full border border-gold-300 bg-white px-3 text-xs font-medium text-gold-700 hover:bg-gold-50 sm:self-auto">
                <X className="size-3.5" /> Show everything
              </button>
            </div>
          )}

          {r.scoped ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat icon={Sparkles} label="Profit" value={money(s.profit)} sub={`${s.margin}% margin`} emphasis />
              <Stat icon={Coins} label="Sales" value={money(s.net)} sub="after discount" />
              <Stat icon={Package} label="Buying cost" value={money(s.cost)} sub="of the items sold" />
              <Stat icon={Receipt} label="Pieces sold" value={num(s.itemsSold)} sub={`in ${num(s.orders)} orders`} />
            </div>
          ) : (
          <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              icon={Sparkles}
              label="Net profit"
              value={<span className={s.netProfit < 0 ? "text-red-300" : ""}>{money(s.netProfit)}</span>}
              sub={`${s.netMargin}% margin · after expenses`}
              emphasis
            />
            <Stat icon={Coins} label="Total sales" value={money(s.net)} sub={s.discount > 0 ? `${money(s.gross)} − ${money(s.discount)} discount` : "after discount"} />
            <Stat icon={TrendingUp} label="Gross profit" value={money(s.profit)} sub={`${s.margin}% · sales − buying cost`} />
            <Stat icon={Wallet} label="Expenses" value={money(s.expenses)} sub={<Link href="/expenses" className="text-gold-700 hover:underline">food, transport, ads… →</Link>} />
          </div>

          <Card className="overflow-hidden">
            <div className="grid grid-cols-1 divide-y divide-line/70 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              {[
                { k: "Total sales", v: money(s.net), op: "" },
                { k: "Buying cost", v: money(s.cost), op: "−" },
                { k: "Expenses", v: money(s.expenses), op: "−" },
                { k: "Net profit", v: money(s.netProfit), op: "=" },
              ].map((x, i) => (
                <div key={x.k} className={cx("flex items-center justify-between gap-3 px-5 py-3.5 sm:block", i === 3 && "bg-gold-50/60")}>
                  <p className="text-xs text-muted">{x.op && <span className="mr-1 font-semibold text-gold-600">{x.op}</span>}{x.k}</p>
                  <p className={cx("font-semibold tabular-nums sm:mt-1 sm:text-lg", i === 3 && (s.netProfit < 0 ? "text-red-600" : "text-emerald-700"))}>{x.v}</p>
                </div>
              ))}
            </div>
            <p className="border-t border-line/70 px-5 py-2.5 text-xs text-muted">Delivery charges are not part of profit.</p>
          </Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat icon={Package} label="Buying cost" value={money(s.cost)} sub="of the items sold" />
            <Stat icon={Receipt} label="Orders" value={num(s.orders)} sub={`${num(s.itemsSold)} pieces · avg ${money(s.avgOrder)}`} />
            <Stat icon={Wallet} label="Money received" value={money(s.received)} sub={`of ${money(s.billed)} billed`} />
            <Stat icon={Wallet} label="Pending payment" value={<span className={s.due > 0 ? "text-red-600" : ""}>{money(s.due)}</span>} sub="still to collect" />
            <Stat icon={Truck} label="Delivery charges" value={money(s.deliveryCollected)} sub={`collected · ${money(s.deliveryNotCollected)} paid by shop`} />
            <Stat icon={Ban} label="Cancelled" value={num(s.cancelledOrders)} sub={s.cancelledOrders ? `${money(s.cancelledValue)} not counted` : "orders"} />
          </div>
          </>
          )}

          <Insights products={r.byProduct} genres={r.byGenre} categories={r.byCategory} scope={category ? "category" : genre ? "genre" : "all"} />

          <Card
            title={`Sales & profit by ${r.granularity}`}
            action={
              <button onClick={() => setShowTable((v) => !v)} className="no-print flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-stone-600 hover:bg-stone-100">
                <Table2 className="size-4" /> {showTable ? "Show chart" : "Show table"}
              </button>
            }
          >
            <div className="p-5">
              {s.orders === 0 && s.expenses === 0 ? (
                <Empty title="No sales in this period" />
              ) : showTable ? (
                <div className="max-h-96 overflow-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-stone-500">
                      <tr><th className="py-2 font-medium">Period</th><th className="py-2 text-right font-medium">Orders</th><th className="py-2 text-right font-medium">Sales</th><th className="py-2 text-right font-medium">Gross profit</th><th className="py-2 text-right font-medium">Expenses</th><th className="py-2 text-right font-medium">Net profit</th></tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {r.timeline.filter((t) => t.orders || t.expenses).map((t) => (
                        <tr key={t.bucket}><td className="py-2">{bucketLabel(t.bucket, true)}</td><td className="py-2 text-right tabular-nums">{t.orders}</td><td className="py-2 text-right tabular-nums">{money(t.sales)}</td><td className="py-2 text-right tabular-nums">{money(t.profit)}</td><td className="py-2 text-right tabular-nums text-muted">{money(t.expenses)}</td><td className={cx("py-2 text-right font-medium tabular-nums", t.netProfit < 0 && "text-red-600")}>{money(t.netProfit)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <SalesChart data={r.timeline} />
              )}
            </div>
          </Card>

          {!category && (
            <div className={cx("grid grid-cols-1 gap-6", !genre && "lg:grid-cols-2")}>
              {!genre && <GenreProfit rows={r.byGenre} onPick={(id) => focus(id)} />}
              <CategoryProfit rows={r.byCategory} showGenre={!genre} onPick={(gid, cid) => focus(gid, cid)} />
            </div>
          )}

          <ProductProfitability rows={r.byProduct} />

          {r.scoped ? (
            <UnsoldStock rows={r.unsold} />
          ) : (
          <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <UnsoldStock rows={r.unsold} />
            <Card title="Expenses by category" action={<Link href="/expenses" className="text-xs font-medium uppercase tracking-wider text-gold-700 hover:text-gold-600">Manage →</Link>}>
              <SimpleTable head={["Category", "Entries", "Amount"]} rows={r.expensesByCategory.map((c) => [c.name, num(c.count), money(c.total)])} />
            </Card>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card title="By payment type">
              <SimpleTable head={["Type", "Orders", "Billed", "Received"]} rows={r.byPayment.map((p) => [p.method, num(p.orders), money(p.billed), money(p.received)])} />
            </Card>
            <Card title="Top cities">
              <SimpleTable head={["City", "Orders", "Sales"]} rows={r.byCity.map((c) => [c.city, num(c.orders), money(c.net)])} />
            </Card>
            <Card title="Order source">
              <SimpleTable head={["Source", "Orders", "Sales"]} rows={r.bySource.map((c) => [c.source, num(c.orders), money(c.net)])} />
            </Card>
          </div>

          <Card title="Orders by status in this period">
            <div className="grid grid-cols-2 gap-px bg-stone-100 sm:grid-cols-4">
              {(["packaging", "out_for_delivery", "delivered", "cancelled"] as OrderStatus[]).map((st) => (
                <div key={st} className="bg-white px-5 py-4">
                  <p className="text-xs text-stone-500">{STATUS_LABEL[st]}</p>
                  <p className="text-xl font-semibold tabular-nums">{num(r.statusCounts[st] ?? 0)}</p>
                </div>
              ))}
            </div>
          </Card>
          </>
          )}
          <p className="pb-4 text-xs text-stone-400">
            Sales use the price entered on each sale (after its discount). Cost uses the buying price at the time of the sale. Delivery charges are never part of profit. Net profit also subtracts the expenses dated in this period.
            Cancelled sales are excluded. Discount is spread across a sale&apos;s items by value for the genre, category and product breakdowns. Margin = profit ÷ sales.
          </p>
        </div>
      )}
    </>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: string[][] }) {
  if (!rows.length) return <Empty title="No data" />;
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-500">
        <tr>{head.map((h, i) => <th key={h} className={cx("py-2.5 font-medium", i === 0 ? "px-5" : "px-3 text-right", i === head.length - 1 && "pr-5")}>{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-stone-100">
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j} className={cx("py-2.5", j === 0 ? "px-5" : "px-3 text-right tabular-nums", j === r.length - 1 && "pr-5")}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
