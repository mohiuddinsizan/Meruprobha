"use client";

import Link from "next/link";
import { AlertTriangle, Coins, Plus, ShoppingBag, Sparkles, Wallet } from "lucide-react";
import { SalesChart } from "@/components/SalesChart";
import { Thumb } from "@/components/ProductBits";
import { Button, Card, Empty, ErrorBox, PageHeader, Spinner, Stat, StatusBadge } from "@/components/ui";
import { useApi } from "@/lib/client";
import { fmtDate, money, num } from "@/lib/format";

type Summary = { orders: number; itemsSold: number; net: number; profit: number; margin: number; received: number; due: number; expenses: number; netProfit: number; netMargin: number };
type Dash = {
  today: Summary;
  month: Summary & { timeline: { bucket: string; sales: number; profit: number; orders: number }[] };
  stock: { products: number; units: number; costValue: number; outOfStock: number };
  lowStockThreshold: number;
  lowStock: { _id: string; name: string; code: string; quantity: number; images: string[] }[];
  recent: { _id: string; orderNo: number; saleDate: string; customer: { name: string }; total: number; status: string; due: number }[];
  pending: Record<string, number>;
  dues: { n: number; due: number };
};

export default function DashboardPage() {
  const { data: d, error } = useApi<Dash>("/api/dashboard", { revalidateOnMount: true });
  const now = new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka", weekday: "long", day: "numeric", month: "long" });
  const hour = Number(new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", hour12: false }));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader eyebrow={now} title={greeting} subtitle="Here's how the boutique is doing." actions={<Button href="/sales/new" className="hidden sm:inline-flex"><Plus className="size-4" /> New sale</Button>} />
      <ErrorBox error={error} />
      {!d && !error && <Spinner />}
      {d && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat icon={ShoppingBag} label="Today's sales" value={money(d.today.net)} sub={`${d.today.orders} ${d.today.orders === 1 ? "order" : "orders"} · profit ${money(d.today.profit)}`} />
            <Stat icon={Sparkles} label="This month's net profit" value={money(d.month.netProfit)} sub={`${money(d.month.profit)} profit − ${money(d.month.expenses)} expenses`} emphasis />
            <Stat icon={Coins} label="This month's sales" value={money(d.month.net)} sub={`${d.month.orders} orders · ${num(d.month.itemsSold)} pcs`} />
            <Stat icon={Wallet} label="Pending payments" value={<span className={d.dues.due > 0 ? "text-red-600" : ""}>{money(d.dues.due)}</span>} sub={`${d.dues.n} orders, all time`} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card title="This month, day by day" className="lg:col-span-2" action={<Link href="/reports" className="text-xs font-medium uppercase tracking-wider text-gold-700 hover:text-gold-600">Full report →</Link>}>
              <div className="p-5">
                {d.month.orders ? <SalesChart data={d.month.timeline} height={240} /> : <Empty title="No sales this month yet" />}
              </div>
            </Card>
            <div className="space-y-6">
              <Card title="To deliver">
                <div className="grid grid-cols-2 divide-x divide-stone-100">
                  <Link href="/sales" className="p-5 hover:bg-stone-50">
                    <p className="font-display text-4xl font-semibold tabular-nums">{d.pending.packaging ?? 0}</p>
                    <p className="text-xs text-stone-500">Packaging done</p>
                  </Link>
                  <Link href="/sales" className="p-5 hover:bg-stone-50">
                    <p className="font-display text-4xl font-semibold tabular-nums">{d.pending.out_for_delivery ?? 0}</p>
                    <p className="text-xs text-stone-500">Out for delivery</p>
                  </Link>
                </div>
              </Card>
              <Card title="Inventory">
                <dl className="space-y-2 p-5 text-sm">
                  <div className="flex justify-between"><dt className="text-stone-600">Products</dt><dd className="font-medium tabular-nums">{num(d.stock.products)}</dd></div>
                  <div className="flex justify-between"><dt className="text-stone-600">Pieces in stock</dt><dd className="font-medium tabular-nums">{num(d.stock.units)}</dd></div>
                  <div className="flex justify-between"><dt className="text-stone-600">Stock value (buying)</dt><dd className="font-medium tabular-nums">{money(d.stock.costValue)}</dd></div>
                  <div className="flex justify-between"><dt className="text-stone-600">Out of stock</dt><dd className="font-medium tabular-nums">{num(d.stock.outOfStock)}</dd></div>
                </dl>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card title="Recent sales" className="lg:col-span-2" action={<Link href="/sales" className="text-xs font-medium uppercase tracking-wider text-gold-700 hover:text-gold-600">All sales →</Link>}>
              {d.recent.length === 0 ? (
                <Empty title="No sales yet"><Link href="/sales/new" className="text-gold-600 underline">Add the first one</Link></Empty>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {d.recent.map((o) => (
                    <li key={o._id}>
                      <Link href={`/sales/${o._id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gold-50/40 sm:gap-4">
                        <span className="w-14 font-display text-base font-semibold text-gold-700">#{o.orderNo}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{o.customer.name}</span>
                          <span className="text-xs text-stone-500">{fmtDate(o.saleDate)}</span>
                        </span>
                        <span className="text-right text-sm font-medium tabular-nums">
                          {money(o.total)}
                          {o.due > 0 && <span className="block text-xs text-red-600">{money(o.due)} pending</span>}
                        </span>
                        <span className="hidden w-32 text-right sm:block"><StatusBadge status={o.status} /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title={<span className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-600" /> Low stock</span>} action={<Link href="/inventory?stock=low" className="text-xs font-medium uppercase tracking-wider text-gold-700 hover:text-gold-600">View →</Link>}>
              {d.lowStock.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-stone-400">All products have more than {d.lowStockThreshold} pieces</p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {d.lowStock.map((p) => (
                    <li key={p._id}>
                      <Link href={`/inventory/${p._id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-stone-50">
                        <Thumb id={p.images[0]} size="size-9" />
                        <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                        <span className={`text-sm font-semibold tabular-nums ${p.quantity === 0 ? "text-red-600" : "text-amber-700"}`}>{p.quantity}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
