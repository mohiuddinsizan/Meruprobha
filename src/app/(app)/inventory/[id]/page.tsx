"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { Archive, ArchiveRestore, Gem, Pencil, Trash2 } from "lucide-react";
import { Badge, Button, Card, ErrorBox, PageHeader, Spinner, cx, useConfirm, useToast } from "@/components/ui";
import { StockBadge } from "@/components/ProductBits";
import { api, imgUrl, useApi } from "@/lib/client";
import { fmtDate, money, num } from "@/lib/format";
import type { HistoryEntry, Product } from "@/lib/types";

type Detail = Product & { history: HistoryEntry[]; sold: { qty: number; revenue: number } };

const TYPE_LABEL: Record<string, { label: string; tone: "stone" | "gold" | "blue" | "green" | "red" | "amber" }> = {
  created: { label: "Created", tone: "green" },
  edit: { label: "Edited", tone: "gold" },
  sale: { label: "Sold", tone: "blue" },
  sale_edit: { label: "Sale edited", tone: "blue" },
  cancel: { label: "Sale cancelled", tone: "red" },
  reactivate: { label: "Sale re-opened", tone: "amber" },
  order_deleted: { label: "Sale deleted", tone: "stone" },
};

const show = (field: string, v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  if (/price/i.test(field) && typeof v === "number") return money(v);
  const s = String(v);
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
};

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: p, error, mutate } = useApi<Detail>(`/api/products/${id}`, { revalidateOnMount: true });
  const { data: settings } = useApi<{ lowStockThreshold: number }>("/api/settings");
  const [img, setImg] = useState(0);
  const [filter, setFilter] = useState<"all" | "edits" | "stock">("all");

  if (error) return <ErrorBox error={error} />;
  if (!p) return <Spinner />;

  const archive = async (archived: boolean) => {
    await api(`/api/products/${id}`, "PATCH", { archived });
    toast(archived ? "Archived — hidden from inventory and sales" : "Restored");
    mutate();
  };
  const remove = async () => {
    const ok = await confirm({
      title: "Delete product?",
      message: "If this product appears in any sale it will be archived instead, so your sales history stays correct.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    const r = await api<{ archived: boolean }>(`/api/products/${id}`, "DELETE");
    toast(r.archived ? "Product has sales, so it was archived" : "Product deleted");
    router.push("/inventory");
  };

  const history = p.history.filter((h) => (filter === "all" ? true : filter === "edits" ? h.type === "edit" || h.type === "created" : h.qtyChange));

  return (
    <>
      <PageHeader
        back="/inventory"
        title={p.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {p.code} · {p.genre?.name}
            {p.category && ` / ${p.category.name}`}
            {p.archived && <Badge tone="red">Archived</Badge>}
            {p.lastEditedAt && <Badge tone="gold">Last edited {fmtDate(p.lastEditedAt, true)}</Badge>}
          </span>
        }
        actions={
          <>
            <Button href={`/inventory/${id}/edit`}><Pencil className="size-4" /> Edit</Button>
            {p.archived ? (
              <Button variant="secondary" onClick={() => archive(false)}><ArchiveRestore className="size-4" /> Restore</Button>
            ) : (
              <Button variant="secondary" onClick={() => archive(true)}><Archive className="size-4" /> Archive</Button>
            )}
            <Button variant="ghost" onClick={remove} className="text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6">
          <Card>
            <div className="aspect-square overflow-hidden rounded-t-xl bg-stone-100">
              {p.images.length ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgUrl(p.images[Math.min(img, p.images.length - 1)])} alt={p.name} className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-stone-300"><Gem className="size-16" /></div>
              )}
            </div>
            {p.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {p.images.map((im, i) => (
                  <button key={im} onClick={() => setImg(i)} className={cx("size-14 shrink-0 overflow-hidden rounded-md border-2", i === img ? "border-gold-500" : "border-transparent")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgUrl(im)} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Info label="In stock" value={<StockBadge qty={p.quantity} low={settings?.lowStockThreshold ?? 2} />} />
            <Info label="Buying price" value={money(p.buyingPrice)} />
            <Info label="Selling price" value={p.sellingPrice != null ? money(p.sellingPrice) : "—"} />
            <Info label="Sold so far" value={`${num(p.sold.qty)} pcs`} sub={money(p.sold.revenue)} />
          </div>

          {p.description && (
            <Card title="Description">
              <p className="whitespace-pre-wrap p-5 text-sm text-stone-700">{p.description}</p>
            </Card>
          )}

          <Card
            title="History"
            action={
              <div className="flex rounded-lg bg-stone-100 p-0.5 text-xs">
                {(["all", "edits", "stock"] as const).map((k) => (
                  <button key={k} onClick={() => setFilter(k)} className={cx("rounded-md px-2.5 py-1 capitalize", filter === k ? "bg-white font-medium shadow-sm" : "text-stone-500")}>
                    {k === "stock" ? "Stock moves" : k}
                  </button>
                ))}
              </div>
            }
          >
            <ol className="divide-y divide-stone-100">
              {history.length === 0 && <li className="px-5 py-6 text-center text-sm text-stone-400">Nothing here yet</li>}
              {history.map((h, i) => {
                const t = TYPE_LABEL[h.type] ?? { label: h.type, tone: "stone" as const };
                return (
                  <li key={i} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={t.tone}>{t.label}</Badge>
                      <span className="text-xs text-stone-500">{fmtDate(h.at, true)}</span>
                      {h.qtyChange ? (
                        <span className={cx("text-xs font-semibold tabular-nums", h.qtyChange > 0 ? "text-emerald-700" : "text-red-600")}>
                          {h.qtyChange > 0 ? "+" : ""}{h.qtyChange} pcs
                        </span>
                      ) : null}
                      {h.orderId && (
                        <Link href={`/sales/${h.orderId}`} className="text-xs text-gold-600 underline">View sale</Link>
                      )}
                    </div>
                    {h.note && <p className="mt-1 text-sm text-stone-600">{h.note}</p>}
                    {!!h.changes?.length && (
                      <ul className="mt-2 space-y-1 text-sm">
                        {h.changes.map((c, j) => (
                          <li key={j} className="flex flex-wrap gap-x-2">
                            <span className="font-medium text-stone-700">{c.field}:</span>
                            <span className="text-stone-400 line-through">{show(c.field, c.from)}</span>
                            <span className="text-stone-400">→</span>
                            <span className="text-stone-900">{show(c.field, c.to)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}

function Info({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs text-stone-500">{label}</p>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
    </div>
  );
}
