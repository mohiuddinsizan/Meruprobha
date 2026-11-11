"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ChevronRight, LayoutGrid, List, Plus, Search } from "lucide-react";
import { ProductCard, StockBadge, Thumb } from "@/components/ProductBits";
import { FilterButton } from "@/components/PeriodPicker";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Segmented, Select, Spinner } from "@/components/ui";
import { useApi } from "@/lib/client";
import { fmtDate, money, num } from "@/lib/format";
import type { Genre, Product } from "@/lib/types";

export default function InventoryPage() {
  return (
    <Suspense>
      <Inventory />
    </Suspense>
  );
}

function Inventory() {
  const sp = useSearchParams();
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState(sp.get("stock") ?? "");
  const [archived, setArchived] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem("inv-view");
      if (v === "grid" || v === "list") setView(v);
    } catch {}
  }, []);
  const changeView = (v: "grid" | "list") => {
    setView(v);
    try { localStorage.setItem("inv-view", v); } catch {}
  };

  const { data: genres } = useApi<Genre[]>("/api/categories");
  const params = new URLSearchParams({ q, genre, category, stock, archived: archived ? "1" : "" });
  const { data, error } = useApi<{ products: Product[]; lowStockThreshold: number }>(`/api/products?${params}`, { keepPreviousData: true });
  const g = genres?.find((x) => x._id === genre);
  const products = data?.products;
  const low = data?.lowStockThreshold ?? 2;

  const units = products?.reduce((s, p) => s + p.quantity, 0) ?? 0;
  const value = products?.reduce((s, p) => s + p.quantity * p.buyingPrice, 0) ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Boutique"
        title="Inventory"
        subtitle={products ? `${products.length} products · ${num(units)} pieces · ${money(value)} at cost` : " "}
        actions={<Button href="/inventory/new"><Plus className="size-4" /> Add product</Button>}
      />

      <div className="mb-5 space-y-2.5 sm:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gold-500" />
          <input
            type="search"
            placeholder="Search by name or code…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-12 w-full rounded-2xl border border-line bg-white pl-11 pr-4 text-sm shadow-[0_1px_2px_rgba(26,22,19,0.04)] placeholder:text-stone-400 focus:border-gold-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <FilterButton count={(genre ? 1 : 0) + (category ? 1 : 0) + (stock ? 1 : 0) + (archived ? 1 : 0)} onClick={() => setFiltersOpen(true)} />
          <Segmented
            value={view}
            onChange={changeView}
            options={[
              { value: "grid", label: <LayoutGrid className="size-4" />, title: "Grid view" },
              { value: "list", label: <List className="size-4" />, title: "List view" },
            ]}
          />
        </div>
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
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-stone-700">Stock</span>
            <div className="grid grid-cols-2 gap-2">
              {[["", "Any stock"], ["in", "In stock"], ["low", "Low stock"], ["out", "Out of stock"]].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setStock(v)} className={`h-10 rounded-xl border text-sm ${stock === v ? "border-ink bg-ink font-medium text-gold-50" : "border-line bg-white text-stone-700"}`}>{l}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm">
            <span>
              <span className="block font-medium">Show archived</span>
              <span className="block text-xs text-muted">Products you&apos;ve stopped selling</span>
            </span>
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="size-5 shrink-0 accent-gold-600" />
          </label>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => { setGenre(""); setCategory(""); setStock(""); setArchived(false); }}>Reset</Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>

      <Card className="mb-5 hidden sm:block">
        <div className="grid gap-2.5 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-[1fr_170px_170px_150px_auto_auto] lg:items-center">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gold-500" />
            <Input placeholder="Search by name or code…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
          </div>
          <Select value={genre} onChange={(e) => { setGenre(e.target.value); setCategory(""); }} aria-label="Genre">
            <option value="">All genres</option>
            {genres?.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} disabled={!g?.categories.length} aria-label="Category">
            <option value="">All categories</option>
            {g?.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
          <Select value={stock} onChange={(e) => setStock(e.target.value)} aria-label="Stock">
            <option value="">Any stock</option>
            <option value="in">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </Select>
          <div className="flex items-center justify-between gap-3 sm:col-span-2 lg:col-span-2 lg:justify-end">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="size-4 accent-gold-600" /> Archived
            </label>
            <Segmented
              value={view}
              onChange={changeView}
              options={[
                { value: "grid", label: <LayoutGrid className="size-4" />, title: "Grid view" },
                { value: "list", label: <List className="size-4" />, title: "List view" },
              ]}
            />
          </div>
        </div>
      </Card>

      <ErrorBox error={error} />
      {!products && !error && <Spinner />}
      {products?.length === 0 && (
        <Card>
          <Empty title={q || genre || stock ? "No pieces match these filters" : "Your collection is empty"}>
            {!q && !genre && !stock && <Link href="/inventory/new" className="font-medium text-gold-700 underline-offset-4 hover:underline">Add your first product</Link>}
          </Empty>
        </Card>
      )}

      {!!products?.length && view === "grid" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((p) => <ProductCard key={p._id} p={p} low={low} />)}
        </div>
      )}

      {!!products?.length && view === "list" && (
        <Card>
          {/* Phone: stacked rows */}
          <ul className="divide-y divide-line/70 md:hidden">
            {products.map((p) => (
              <li key={p._id}>
                <Link href={`/inventory/${p._id}`} className="flex items-center gap-3 px-4 py-3 active:bg-gold-50/50">
                  <Thumb id={p.images[0]} size="size-14" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{p.name}</p>
                    <p className="truncate text-xs text-muted">{p.genre?.name}{p.category && ` · ${p.category.name}`} · {p.code}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <StockBadge qty={p.quantity} low={low} />
                      <span className="text-sm font-semibold tabular-nums">{p.sellingPrice != null ? money(p.sellingPrice) : money(p.buyingPrice)}</span>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-stone-300" />
                </Link>
              </li>
            ))}
          </ul>
          {/* Tablet & desktop: table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-[11px] uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-5 py-3.5 font-medium">Product</th>
                  <th className="px-3 py-3.5 font-medium">Genre / Category</th>
                  <th className="px-3 py-3.5 text-right font-medium">Cost</th>
                  <th className="px-3 py-3.5 text-right font-medium">Selling</th>
                  <th className="px-3 py-3.5 font-medium">Stock</th>
                  <th className="px-5 py-3.5 font-medium">Last edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {products.map((p) => (
                  <tr key={p._id} className="transition-colors hover:bg-gold-50/40">
                    <td className="px-5 py-3">
                      <Link href={`/inventory/${p._id}`} className="flex items-center gap-3">
                        <Thumb id={p.images[0]} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">{p.name}</span>
                          <span className="text-xs text-stone-400">{p.code}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-muted">
                      {p.genre?.name ?? "—"}
                      {p.category && <span className="text-stone-400"> / {p.category.name}</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{money(p.buyingPrice)}</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">{p.sellingPrice != null ? money(p.sellingPrice) : <span className="text-stone-400">—</span>}</td>
                    <td className="px-3 py-3"><StockBadge qty={p.quantity} low={low} /></td>
                    <td className="px-5 py-3">
                      {p.lastEditedAt ? <Badge tone="gold">Edited {fmtDate(p.lastEditedAt)}</Badge> : <span className="text-xs text-stone-400">Never</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
