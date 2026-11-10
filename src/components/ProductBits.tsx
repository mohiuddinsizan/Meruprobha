"use client";

import Link from "next/link";
import { Gem } from "lucide-react";
import { Badge, cx } from "./ui";
import { imgUrl } from "@/lib/client";
import { money, num } from "@/lib/format";
import type { Product } from "@/lib/types";

export function Thumb({ id, size = "size-11" }: { id?: string; size?: string }) {
  return (
    <span className={`${size} grid shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-gold-50 to-ivory text-gold-300 ring-1 ring-line`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {id ? <img src={imgUrl(id)} alt="" className="size-full object-cover" loading="lazy" /> : <Gem className="size-[45%]" strokeWidth={1.5} />}
    </span>
  );
}

export function StockBadge({ qty, low }: { qty: number; low: number }) {
  if (qty === 0) return <Badge tone="red">Out of stock</Badge>;
  if (qty <= low) return <Badge tone="amber">{qty} left</Badge>;
  return <Badge tone="green">{num(qty)} in stock</Badge>;
}

export function ProductCard({ p, low }: { p: Product; low: number }) {
  return (
    <Link
      href={`/inventory/${p._id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(26,22,19,0.04)] transition-all hover:-translate-y-0.5 hover:border-gold-200 hover:shadow-[0_12px_32px_-12px_rgba(26,22,19,0.18)]"
    >
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-gold-50 via-ivory to-white">
        {p.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl(p.images[0])} alt={p.name} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="grid size-full place-items-center text-gold-200">
            <Gem className="size-12" strokeWidth={1} />
          </div>
        )}
        <div className="absolute left-2.5 top-2.5">
          <StockBadge qty={p.quantity} low={low} />
        </div>
        {p.lastEditedAt && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-gold-700 ring-1 ring-gold-200 backdrop-blur">Edited</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-gold-600">
          {p.genre?.name ?? "—"}
          {p.category && <span className="text-stone-400"> · {p.category.name}</span>}
        </p>
        <p className="mt-1 line-clamp-2 font-display text-lg font-semibold leading-snug text-ink">{p.name}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-stone-400">Selling</p>
            <p className={cx("text-sm font-semibold tabular-nums", p.sellingPrice == null && "text-stone-400")}>{p.sellingPrice != null ? money(p.sellingPrice) : "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-stone-400">Cost</p>
            <p className="text-sm tabular-nums text-muted">{money(p.buyingPrice)}</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-stone-400">{p.code}</p>
      </div>
    </Link>
  );
}
