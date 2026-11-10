"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Award, ChevronRight, Crown, Gem, Percent, Search, ShoppingBag, TrendingDown } from "lucide-react";
import { Thumb } from "./ProductBits";
import { Card, Empty, Input, Segmented, cx } from "./ui";
import { money, num } from "@/lib/format";

type Metrics = { qty: number; net: number; cost: number; profit: number; margin: number; perPiece: number };
export type GenreRow = Metrics & { _id: string; name: string };
export type CategoryRow = Metrics & { _id: string; genre: string; category: string | null; genreName: string; name: string };
export type ProductRow = Metrics & { _id: string; name: string; code: string; genreName: string; categoryName: string; orders: number; stock: number; image: string | null; archived: boolean };
export type UnsoldRow = { _id: string; name: string; code: string; quantity: number; stockValue: number; genreName: string; image: string | null };

const pct = (v: number) => `${v.toFixed(v >= 100 || v <= -100 ? 0 : 1)}%`;

/* ---------- Highlight cards ---------- */
export function Insights({ products, genres, categories, scope }: { products: ProductRow[]; genres: GenreRow[]; categories: CategoryRow[]; scope: "all" | "genre" | "category" }) {
  if (!products.length) return null;
  const top = (arr: ProductRow[], key: keyof Metrics) => [...arr].sort((a, b) => (b[key] as number) - (a[key] as number))[0];
  const mostProfit = top(products, "profit");
  const bestSeller = top(products, "qty");
  const sellable = products.filter((p) => p.net > 0);
  const bestMargin = sellable.length ? top(sellable, "margin") : undefined;
  const weakest = [...products].sort((a, b) => a.margin - b.margin)[0];

  const groupCard =
    scope === "all" && genres[0]
      ? { label: "Most profitable genre", name: genres[0].name, value: money(genres[0].profit), sub: `${pct(genres[0].margin)} margin · ${num(genres[0].qty)} pcs`, icon: Crown }
      : scope === "genre" && categories[0]
        ? { label: "Most profitable category", name: categories[0].name, value: money(categories[0].profit), sub: `${pct(categories[0].margin)} margin · ${num(categories[0].qty)} pcs`, icon: Crown }
        : { label: "Lowest margin product", name: weakest.name, value: pct(weakest.margin), sub: `${money(weakest.profit)} profit · ${num(weakest.qty)} pcs`, icon: TrendingDown };

  const cards = [
    { label: "Most profitable product", name: mostProfit.name, value: money(mostProfit.profit), sub: `${num(mostProfit.qty)} pcs · ${pct(mostProfit.margin)} margin`, icon: Award, href: `/inventory/${mostProfit._id}`, star: true },
    { label: "Best seller", name: bestSeller.name, value: `${num(bestSeller.qty)} pcs`, sub: `${money(bestSeller.net)} sales · ${money(bestSeller.profit)} profit`, icon: ShoppingBag, href: `/inventory/${bestSeller._id}` },
    bestMargin && { label: "Highest margin", name: bestMargin.name, value: pct(bestMargin.margin), sub: `${money(bestMargin.perPiece)} profit per piece`, icon: Percent, href: `/inventory/${bestMargin._id}` },
    groupCard,
  ].filter(Boolean) as { label: string; name: string; value: string; sub: string; icon: typeof Award; href?: string; star?: boolean }[];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      {cards.map((c) => {
        const body = (
          <>
            <div className="flex items-center gap-2">
              <span className={cx("grid size-7 place-items-center rounded-full", c.star ? "gold-fill text-espresso" : "bg-gold-50 text-gold-600")}>
                <c.icon className="size-3.5" />
              </span>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">{c.label}</p>
            </div>
            <p className="mt-3 line-clamp-1 font-display text-xl font-semibold leading-tight text-ink">{c.name}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{c.value}</p>
            <p className="mt-0.5 text-xs text-muted">{c.sub}</p>
          </>
        );
        const cls = cx("block rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(26,22,19,0.04)]", c.star ? "border-gold-300" : "border-line", c.href && "transition-colors hover:border-gold-300");
        return c.href ? <Link key={c.label} href={c.href} className={cls}>{body}</Link> : <div key={c.label} className={cls}>{body}</div>;
      })}
    </div>
  );
}

/* ---------- Genre / category profit tables ---------- */
type GroupRow = Metrics & { key: string; name: string; sub?: string; onClick?: () => void };

function ProfitShareTable({ rows, emptyText }: { rows: GroupRow[]; emptyText: string }) {
  if (!rows.length) return <Empty title={emptyText} />;
  const totalProfit = rows.reduce((s, r) => s + Math.max(r.profit, 0), 0);
  return (
    <>
      {/* Phone */}
      <ul className="divide-y divide-line/70 md:hidden">
        {rows.map((r) => {
          const share = totalProfit > 0 ? (Math.max(r.profit, 0) / totalProfit) * 100 : 0;
          const Inner = (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate font-medium">{r.name}{r.sub && <span className="text-xs font-normal text-muted"> · {r.sub}</span>}</p>
                <p className={cx("shrink-0 font-semibold tabular-nums", r.profit < 0 && "text-red-600")}>{money(r.profit)}</p>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-ivory"><div className="h-1.5 rounded-full bg-series-2" style={{ width: `${Math.max(share, 1)}%` }} /></div>
                <span className="text-xs tabular-nums text-muted">{share.toFixed(0)}% of profit</span>
              </div>
              <p className="mt-1 text-xs text-muted">{num(r.qty)} pcs · {money(r.net)} sales · {pct(r.margin)} margin</p>
            </>
          );
          return (
            <li key={r.key}>
              {r.onClick ? <button onClick={r.onClick} className="block w-full px-4 py-3 text-left active:bg-gold-50/40">{Inner}</button> : <div className="px-4 py-3">{Inner}</div>}
            </li>
          );
        })}
      </ul>
      {/* Tablet & desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-[11px] uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Name · share of profit</th>
              <th className="px-3 py-3 text-right font-medium">Pcs</th>
              <th className="px-3 py-3 text-right font-medium">Sales</th>
              <th className="px-3 py-3 text-right font-medium">Profit</th>
              <th className="px-3 py-3 text-right font-medium">Margin</th>
              <th className="w-8 pr-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {rows.map((r) => {
              const share = totalProfit > 0 ? (Math.max(r.profit, 0) / totalProfit) * 100 : 0;
              return (
                <tr key={r.key} onClick={r.onClick} className={cx(r.onClick && "cursor-pointer transition-colors hover:bg-gold-50/40")}>
                  <td className="px-5 py-2.5">
                    <p className="font-medium">{r.name}{r.sub && <span className="text-xs font-normal text-muted"> · {r.sub}</span>}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 w-full max-w-44 rounded-full bg-ivory"><div className="h-1.5 rounded-full bg-series-2" style={{ width: `${Math.max(share, 1)}%` }} /></div>
                      <span className="text-xs tabular-nums text-muted">{share.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{num(r.qty)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(r.net)}</td>
                  <td className={cx("px-3 py-2.5 text-right font-semibold tabular-nums", r.profit < 0 && "text-red-600")}>{money(r.profit)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{pct(r.margin)}</td>
                  <td className="pr-3 text-stone-300">{r.onClick && <ChevronRight className="size-4" />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function GenreProfit({ rows, onPick }: { rows: GenreRow[]; onPick: (id: string) => void }) {
  return (
    <Card title="Profit by genre" action={<span className="text-xs text-muted">Click to focus</span>}>
      <ProfitShareTable emptyText="No sales" rows={rows.map((g) => ({ ...g, key: g._id, onClick: () => onPick(g._id) }))} />
    </Card>
  );
}

export function CategoryProfit({ rows, showGenre, onPick }: { rows: CategoryRow[]; showGenre: boolean; onPick: (genre: string, category: string | null) => void }) {
  return (
    <Card title="Profit by category" action={<span className="text-xs text-muted">Click to focus</span>}>
      <ProfitShareTable
        emptyText="No sales"
        rows={rows.map((c) => ({ ...c, key: c._id, sub: showGenre ? c.genreName : undefined, onClick: c.category ? () => onPick(c.genre, c.category) : undefined }))}
      />
    </Card>
  );
}

/* ---------- Product profitability ---------- */
const SORTS = [
  { value: "profit", label: "Profit" },
  { value: "net", label: "Sales" },
  { value: "qty", label: "Pcs" },
  { value: "margin", label: "Margin" },
  { value: "perPiece", label: "Per piece" },
] as const;
type SortKey = (typeof SORTS)[number]["value"];

export function ProductProfitability({ rows }: { rows: ProductRow[] }) {
  const [sort, setSort] = useState<SortKey>("profit");
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => {
    const f = q.trim().toLowerCase();
    return rows.filter((r) => !f || (r.name + " " + r.code).toLowerCase().includes(f)).sort((a, b) => b[sort] - a[sort]);
  }, [rows, sort, q]);
  const shown = all ? sorted : sorted.slice(0, 10);

  return (
    <Card title="Product profitability" action={<span className="hidden text-xs text-muted sm:inline">{rows.length} products sold</span>}>
      <div className="flex flex-col gap-2.5 border-b border-line/70 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gold-500" />
          <Input placeholder="Find a product…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 pl-10" />
        </div>
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <div className="flex w-max items-center gap-2">
            <span className="text-xs text-muted">Rank by</span>
            <Segmented value={sort} onChange={setSort} options={SORTS.map((s) => ({ value: s.value, label: s.label }))} />
          </div>
        </div>
      </div>

      {!rows.length ? (
        <Empty title="No products sold in this period" />
      ) : (
        <>
          {/* Phone */}
          <ol className="divide-y divide-line/70 md:hidden">
            {shown.map((p, i) => (
              <li key={p._id}>
                <Link href={`/inventory/${p._id}`} className="flex items-center gap-3 px-4 py-3 active:bg-gold-50/40">
                  <span className={cx("w-5 text-center font-display text-lg font-semibold", i < 3 ? "text-gold-600" : "text-stone-300")}>{i + 1}</span>
                  <Thumb id={p.image ?? undefined} size="size-11" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="truncate text-xs text-muted">{num(p.qty)} pcs · {money(p.net)} · {pct(p.margin)}</p>
                  </div>
                  <div className="text-right">
                    <p className={cx("font-semibold tabular-nums", p.profit < 0 && "text-red-600")}>{sort === "margin" ? pct(p.margin) : sort === "qty" ? `${num(p.qty)} pcs` : sort === "net" ? money(p.net) : sort === "perPiece" ? money(p.perPiece) : money(p.profit)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-stone-400">{SORTS.find((s) => s.value === sort)!.label}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
          {/* Tablet & desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-[11px] uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="w-10 py-3 pl-5 font-medium">#</th>
                  <th className="px-3 py-3 font-medium">Product</th>
                  {SORTS.map((s) => (
                    <th key={s.value} className="px-3 py-3 text-right font-medium">
                      <button onClick={() => setSort(s.value)} className={cx("uppercase tracking-[0.12em]", sort === s.value ? "text-gold-700 underline decoration-gold-400 underline-offset-4" : "hover:text-ink")}>
                        {s.label}
                      </button>
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right font-medium">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {shown.map((p, i) => (
                  <tr key={p._id} className="transition-colors hover:bg-gold-50/40">
                    <td className={cx("py-2.5 pl-5 font-display text-lg font-semibold", i < 3 ? "text-gold-600" : "text-stone-300")}>{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <Link href={`/inventory/${p._id}`} className="flex items-center gap-3">
                        <Thumb id={p.image ?? undefined} size="size-10" />
                        <span className="min-w-0">
                          <span className="block max-w-[260px] truncate font-medium">{p.name}</span>
                          <span className="text-xs text-muted">{p.genreName}{p.categoryName && ` · ${p.categoryName}`} · {p.code}</span>
                        </span>
                      </Link>
                    </td>
                    <td className={cx("px-3 py-2.5 text-right font-semibold tabular-nums", p.profit < 0 && "text-red-600")}>{money(p.profit)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(p.net)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{num(p.qty)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{pct(p.margin)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(p.perPiece)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-muted">{p.archived ? "archived" : num(p.stock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sorted.length > 10 && (
            <div className="border-t border-line/70 p-3 text-center">
              <button onClick={() => setAll((v) => !v)} className="text-xs font-medium uppercase tracking-wider text-gold-700 hover:text-gold-600">
                {all ? "Show top 10" : `Show all ${sorted.length}`}
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/* ---------- Stock that didn't sell ---------- */
export function UnsoldStock({ rows }: { rows: UnsoldRow[] }) {
  const value = rows.reduce((s, r) => s + r.stockValue, 0);
  return (
    <Card title="Not sold in this period" action={rows.length > 0 && <span className="text-xs text-muted">{money(value)} at cost</span>}>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <Gem className="mb-2 size-6 text-gold-300" />
          <p className="text-sm text-muted">Every product in stock sold at least once in this period.</p>
        </div>
      ) : (
        <ul className="max-h-[420px] divide-y divide-line/70 overflow-y-auto">
          {rows.map((u) => (
            <li key={u._id}>
              <Link href={`/inventory/${u._id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-gold-50/40 sm:px-5">
                <Thumb id={u.image ?? undefined} size="size-9" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.name}</span>
                  <span className="text-xs text-muted">{u.genreName} · {num(u.quantity)} in stock</span>
                </span>
                <span className="text-sm tabular-nums text-muted">{money(u.stockValue)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
