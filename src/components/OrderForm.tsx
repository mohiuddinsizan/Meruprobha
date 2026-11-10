"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Plus, Search, Trash2, UserCheck } from "lucide-react";
import { Thumb } from "./ProductBits";
import { Button, Card, ErrorBox, Field, Input, Select, Spinner, Textarea, cx, useToast } from "./ui";
import { api, useApi } from "@/lib/client";
import { COURIERS, DISTRICTS, ORDER_SOURCES, ORDER_STATUSES, PAYMENT_METHODS, STATUS_LABEL } from "@/lib/constants";
import { toYmd, todayYmd } from "@/lib/dates";
import { money } from "@/lib/format";
import type { Genre, Order, Product, Settings } from "@/lib/types";

type Line = { product: string; name: string; code: string; image?: string; quantity: string; unitPrice: string; unitCost: number };

const n = (s: string | number) => {
  const v = Number(s);
  return Number.isFinite(v) ? v : 0;
};

export function OrderForm({ order }: { order?: Order }) {
  const router = useRouter();
  const toast = useToast();
  const { data: genres } = useApi<Genre[]>("/api/categories");
  const { data: inv } = useApi<{ products: Product[] }>("/api/products", { revalidateOnMount: true });
  const { data: settings } = useApi<Settings>("/api/settings");

  const [lines, setLines] = useState<Line[]>(
    order?.items.map((i) => ({ product: i.product, name: i.name, code: i.code, quantity: String(i.quantity), unitPrice: String(i.unitPrice), unitCost: i.unitCost })) ?? []
  );
  const [customer, setCustomer] = useState(order?.customer ?? { name: "", phone: "", altPhone: "" });
  const [delivery, setDelivery] = useState(order?.delivery ?? { city: "", address: "" });
  const [courier, setCourier] = useState(order?.courier ?? { name: "", trackingId: "" });
  const [deliveryCharge, setDeliveryCharge] = useState(order ? String(order.deliveryCharge) : "");
  const [dcTouched, setDcTouched] = useState(!!order);
  const [collected, setCollected] = useState(order?.deliveryChargeCollected ?? true);
  const [paymentMethod, setPaymentMethod] = useState(order?.paymentMethod ?? "Cash on Delivery");
  const [discount, setDiscount] = useState(order ? String(order.discount || "") : "");
  const [amountPaid, setAmountPaid] = useState(order ? String(order.amountPaid || "") : "");
  const [saleDate, setSaleDate] = useState(order ? toYmd(order.saleDate) : todayYmd());
  const [status, setStatus] = useState(order?.status ?? "packaging");
  const [source, setSource] = useState(order?.source ?? "");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [returning, setReturning] = useState<{ name: string; altPhone: string; delivery: { city: string; address: string }; orders: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Stock that this order already holds (when editing an active order) is available to it again.
  const held = useMemo(() => {
    const m = new Map<string, number>();
    if (order && order.status !== "cancelled") for (const i of order.items) m.set(i.product, (m.get(i.product) ?? 0) + i.quantity);
    return m;
  }, [order]);
  const products = inv?.products;
  const byId = useMemo(() => new Map((products ?? []).map((p) => [p._id, p])), [products]);
  const available = (pid: string) => (byId.get(pid)?.quantity ?? 0) + (held.get(pid) ?? 0);

  const subtotal = lines.reduce((s, l) => s + n(l.quantity) * n(l.unitPrice), 0);
  const cost = lines.reduce((s, l) => s + n(l.quantity) * l.unitCost, 0);
  const disc = n(discount);
  const dc = n(deliveryCharge);
  const total = subtotal - disc + (collected ? dc : 0);
  const paid = n(amountPaid);
  const due = total - paid;
  const profit = subtotal - disc - cost;

  const addProduct = (p: Product) => {
    setLines((ls) => {
      const existing = ls.find((l) => l.product === p._id);
      if (existing) return ls.map((l) => (l === existing ? { ...l, quantity: String(n(l.quantity) + 1) } : l));
      return [
        ...ls,
        { product: p._id, name: p.name, code: p.code, image: p.images[0], quantity: "1", unitPrice: p.sellingPrice != null ? String(p.sellingPrice) : "", unitCost: p.buyingPrice },
      ];
    });
  };
  const updLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const onCity = (city: string) => {
    setDelivery((d) => ({ ...d, city }));
    if (!dcTouched && settings && city) setDeliveryCharge(String(city === "Dhaka" ? settings.deliveryInsideDhaka : settings.deliveryOutsideDhaka));
  };

  const lookup = async () => {
    if (order || !/^(\+?88)?01\d{9}$/.test(customer.phone.replace(/[\s-]/g, ""))) return;
    const r = await api<{ customer: typeof returning & { phone: string } }>(`/api/customers?phone=${encodeURIComponent(customer.phone)}`).catch(() => null);
    setReturning(r?.customer ?? null);
  };
  const fillReturning = () => {
    if (!returning) return;
    setCustomer((c) => ({ ...c, name: returning.name, altPhone: returning.altPhone || c.altPhone }));
    onCity(returning.delivery.city);
    setDelivery(returning.delivery);
    setReturning(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!lines.length) return setError("Add at least one product");
    const over = lines.find((l) => order?.status !== "cancelled" && n(l.quantity) > available(l.product));
    if (over && status !== "cancelled") return setError(`Not enough stock for "${over.name}" (available ${available(over.product)})`);
    setSaving(true);
    const body = {
      items: lines.map((l) => ({ product: l.product, quantity: n(l.quantity), unitPrice: l.unitPrice })),
      customer,
      delivery,
      courier,
      deliveryCharge: dc,
      deliveryChargeCollected: collected,
      paymentMethod,
      discount: disc,
      amountPaid: paid,
      saleDate,
      status,
      source,
      notes,
    };
    try {
      if (order) {
        await api(`/api/orders/${order._id}`, "PATCH", body);
        toast("Sale updated");
        router.push(`/sales/${order._id}`);
      } else {
        const r = await api<{ _id: string; orderNo: number }>("/api/orders", "POST", body);
        toast(`Sale #${r.orderNo} saved`);
        router.push(`/sales/${r._id}`);
      }
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  if (!genres || !products || !settings) return <Spinner />;

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
      <div className="min-w-0 space-y-6 lg:col-span-2">
        <Card title="Products">
          <ProductPicker genres={genres} products={products} available={available} onPick={addProduct} />
          {lines.length === 0 ? (
            <p className="border-t border-stone-100 px-5 py-8 text-center text-sm text-stone-400">No products added yet. Pick one above.</p>
          ) : (
            <ul className="divide-y divide-stone-100 border-t border-stone-100">
              {lines.map((l, i) => {
                const avail = available(l.product);
                const short = status !== "cancelled" && n(l.quantity) > avail;
                const lowPrice = l.unitPrice !== "" && n(l.unitPrice) < l.unitCost;
                return (
                  <li key={l.product} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-5 py-3 sm:grid-cols-[auto_1fr_90px_130px_110px_auto] sm:items-center">
                    <Thumb id={l.image ?? byId.get(l.product)?.images[0]} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.name}</p>
                      <p className="text-xs text-stone-500">
                        {l.code} · cost {money(l.unitCost)} ·{" "}
                        <span className={cx(short && "font-semibold text-red-600")}>{avail} available</span>
                      </p>
                      {lowPrice && <p className="text-xs text-amber-700">Selling below buying price</p>}
                    </div>
                    <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="rounded p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 sm:order-last" aria-label="Remove">
                      <Trash2 className="size-4" />
                    </button>
                    <div className="col-span-3 grid grid-cols-3 gap-2 sm:col-span-3 sm:contents">
                      <label className="text-xs text-stone-500">
                        <span className="sm:sr-only">Qty</span>
                        <Input type="number" min={1} step={1} value={l.quantity} onChange={(e) => updLine(i, { quantity: e.target.value })} className={cx(short && "border-red-400")} required aria-label="Quantity" />
                      </label>
                      <label className="text-xs text-stone-500">
                        <span className="sm:sr-only">Price each (৳)</span>
                        <Input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => updLine(i, { unitPrice: e.target.value })} placeholder="Price" required aria-label="Selling price each" />
                      </label>
                      <div className="text-right text-xs text-stone-500 sm:text-sm">
                        <span className="sm:hidden">Total</span>
                        <p className="pt-2.5 font-semibold tabular-nums text-stone-900 sm:pt-0">{money(n(l.quantity) * n(l.unitPrice))}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Customer">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Phone" required>
              <Input type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} onBlur={lookup} placeholder="01XXXXXXXXX" required inputMode="tel" />
            </Field>
            <Field label="Name" required>
              <Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} required />
            </Field>
            {returning && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gold-50 px-3 py-2 text-sm sm:col-span-2">
                <span className="flex items-center gap-2 text-gold-700">
                  <UserCheck className="size-4" /> Returning customer: <b>{returning.name}</b> ({returning.orders} past orders)
                </span>
                <Button type="button" size="sm" variant="secondary" onClick={fillReturning}>Fill details</Button>
              </div>
            )}
            <Field label="Alternative phone">
              <Input type="tel" value={customer.altPhone} onChange={(e) => setCustomer({ ...customer, altPhone: e.target.value })} inputMode="tel" />
            </Field>
          </div>
        </Card>

        <Card title="Delivery">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="City / District" required>
              <Select value={delivery.city} onChange={(e) => onCity(e.target.value)} required>
                <option value="">Select district</option>
                {DISTRICTS.map((d) => (
                  <optgroup key={d.division} label={`${d.division} Division`}>
                    {d.districts.map((c) => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <Field label="Delivery charge (৳)" hint={`Default: Dhaka ${money(settings.deliveryInsideDhaka)}, outside ${money(settings.deliveryOutsideDhaka)}`}>
              <Input type="number" min={0} step="0.01" value={deliveryCharge} onChange={(e) => { setDcTouched(true); setDeliveryCharge(e.target.value); }} />
            </Field>
            <Field label="Full address / extra info" className="sm:col-span-2">
              <Textarea value={delivery.address} onChange={(e) => setDelivery({ ...delivery, address: e.target.value })} placeholder="House, road, area, thana, landmark…" />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={collected} onChange={(e) => setCollected(e.target.checked)} className="size-4 accent-gold-600" />
              Collect delivery charge from customer
              <span className="text-stone-400">{collected ? "(added to customer's bill)" : "(shop pays it — free delivery)"}</span>
            </label>
            <Field label="Courier">
              <Select value={courier.name} onChange={(e) => setCourier({ ...courier, name: e.target.value })}>
                <option value="">Not set</option>
                {COURIERS.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Tracking / consignment ID">
              <Input value={courier.trackingId} onChange={(e) => setCourier({ ...courier, trackingId: e.target.value })} />
            </Field>
          </div>
        </Card>
      </div>

      <div className="min-w-0 space-y-6">
        <Card title="Sale info">
          <div className="space-y-4 p-5">
            <Field label="Sale date" required>
              <Input type="date" value={saleDate} max={todayYmd()} onChange={(e) => setSaleDate(e.target.value)} required />
            </Field>
            {!order && (
              <Field label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {ORDER_STATUSES.filter((s) => s !== "cancelled").map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Order came from">
              <Select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">Not set</option>
                {ORDER_SOURCES.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
        </Card>

        <Card title="Payment">
          <div className="space-y-4 p-5">
            <Field label="Payment type" required>
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required>
                {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </Field>
            <Field label="Discount (৳)">
              <Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Amount paid so far (৳)" hint="Advance or full payment received. The rest stays as pending.">
              <div className="flex gap-2">
                <Input type="number" min={0} step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0" />
                <Button type="button" variant="secondary" onClick={() => setAmountPaid(String(Math.max(total, 0)))}>Full</Button>
              </div>
            </Field>

            <dl className="space-y-1.5 rounded-xl border border-gold-100 bg-gold-50/50 p-4 text-sm">
              <Row k="Products" v={money(subtotal)} />
              {disc > 0 && <Row k="Discount" v={`− ${money(disc)}`} />}
              <Row k={collected ? "Delivery charge" : "Delivery (shop pays)"} v={collected ? money(dc) : money(0)} />
              <Row k="Customer pays" v={money(total)} bold />
              <Row k="Paid" v={money(paid)} />
              <Row k="Pending" v={money(due)} bold className={due > 0 ? "text-red-600" : "text-emerald-700"} />
              <div className="hairline-gold my-2 h-px" />
              <Row k="Profit (excl. delivery)" v={money(profit)} className={profit < 0 ? "text-red-600" : "text-emerald-700"} bold />
            </dl>
            <Field label="Notes">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </Field>
          </div>
        </Card>
        <ErrorBox error={error} />
        <div className="flex gap-2">
          <Button type="submit" loading={saving} className="flex-1">{order ? "Save changes" : "Save sale"}</Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        </div>
      </div>
    </form>
  );
}

function Row({ k, v, bold, className }: { k: string; v: string; bold?: boolean; className?: string }) {
  return (
    <div className={cx("flex justify-between gap-4", bold && "font-semibold", className)}>
      <dt className={cx(!className && "text-stone-600")}>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}

/** Pick by genre → category → product, or search by name/code. */
function ProductPicker({ genres, products, available, onPick }: { genres: Genre[]; products: Product[]; available: (id: string) => number; onPick: (p: Product) => void }) {
  const [genre, setGenre] = useState("");
  const [category, setCategory] = useState("");
  const [pid, setPid] = useState("");
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const blurT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const g = genres.find((x) => x._id === genre);
  const filtered = products.filter((p) => (!genre || p.genre?._id === genre) && (!category || p.category?._id === category));
  const matches = q.trim()
    ? products.filter((p) => (p.name + " " + p.code).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : [];

  const pick = (p: Product) => {
    onPick(p);
    setPid("");
    setQ("");
  };

  return (
    <div className="space-y-3 p-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
        <Input
          placeholder="Quick search product by name or code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => { clearTimeout(blurT.current); setFocus(true); }}
          onBlur={() => (blurT.current = setTimeout(() => setFocus(false), 150))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches[0] && available(matches[0]._id) > 0) pick(matches[0]);
            }
          }}
          className="pl-9"
        />
        {focus && matches.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
            {matches.map((p) => {
              const a = available(p._id);
              return (
                <li key={p._id}>
                  <button type="button" disabled={a <= 0} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-stone-50 disabled:opacity-40">
                    <Thumb id={p.images[0]} size="size-8" />
                    <span className="min-w-0 flex-1 truncate">{p.name} <span className="text-xs text-stone-400">{p.code}</span></span>
                    <span className="text-xs text-stone-500">{a > 0 ? `${a} in stock` : "Out of stock"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-stone-400">
        <span className="h-px flex-1 bg-line" /> or choose step by step <span className="h-px flex-1 bg-line" />
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.5fr_auto]">
        <Select value={genre} onChange={(e) => { setGenre(e.target.value); setCategory(""); setPid(""); }} aria-label="Genre">
          <option value="">All genres</option>
          {genres.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
        </Select>
        <Select value={category} onChange={(e) => { setCategory(e.target.value); setPid(""); }} disabled={!g?.categories.length} aria-label="Category">
          <option value="">All categories</option>
          {g?.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </Select>
        <Select value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Product">
          <option value="">{filtered.length ? `Select product (${filtered.length})` : "No products here"}</option>
          {filtered.map((p) => {
            const a = available(p._id);
            return (
              <option key={p._id} value={p._id} disabled={a <= 0}>
                {p.name} — {a > 0 ? `${a} in stock` : "out of stock"}
              </option>
            );
          })}
        </Select>
        <Button type="button" disabled={!pid} onClick={() => { const p = products.find((x) => x._id === pid); if (p) pick(p); }}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
    </div>
  );
}
