"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { Check, Copy, Pencil, Printer, RotateCcw, Trash2, XCircle } from "lucide-react";
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, PaymentBadge, Spinner, StatusBadge, cx, useConfirm, useToast } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { STATUS_LABEL, type OrderStatus } from "@/lib/constants";
import { fmtDate, money } from "@/lib/format";
import type { Order } from "@/lib/types";

const FLOW: OrderStatus[] = ["packaging", "out_for_delivery", "delivered"];

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: o, error, mutate } = useApi<Order>(`/api/orders/${id}`, { revalidateOnMount: true });
  const [busy, setBusy] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmt, setPayAmt] = useState("");
  const [payErr, setPayErr] = useState<unknown>(null);

  if (error) return <ErrorBox error={error} />;
  if (!o) return <Spinner />;

  const setStatus = async (status: OrderStatus) => {
    if (status === "cancelled") {
      const ok = await confirm({
        title: `Cancel sale #${o.orderNo}?`,
        message: "All items in this sale go back into inventory. It will no longer count in reports. You can re-open it later.",
        confirmText: "Cancel sale",
        danger: true,
      });
      if (!ok) return;
    }
    if (o.status === "cancelled") {
      const ok = await confirm({ title: "Re-open this sale?", message: "The items will be taken from inventory again (if enough stock is available)." });
      if (!ok) return;
    }
    setBusy(status);
    try {
      await api(`/api/orders/${id}/status`, "POST", { status });
      toast(`Marked as ${STATUS_LABEL[status]}`);
      await mutate();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(null);
    }
  };

  const markPaid = async () => {
    setBusy("pay");
    try {
      await api(`/api/orders/${id}/payment`, "POST", { markPaid: true });
      toast("Marked as fully paid");
      await mutate();
    } finally {
      setBusy(null);
    }
  };

  const savePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayErr(null);
    try {
      await api(`/api/orders/${id}/payment`, "POST", { amountPaid: payAmt });
      toast("Payment updated");
      setPayOpen(false);
      mutate();
    } catch (err) {
      setPayErr(err);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete sale #${o.orderNo} permanently?`,
      message: "Use this only for mistakes. Items are returned to inventory. To keep a record, cancel the sale instead.",
      confirmText: "Delete forever",
      danger: true,
    });
    if (!ok) return;
    await api(`/api/orders/${id}`, "DELETE");
    toast("Sale deleted");
    router.push("/sales");
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(`${o.customer.name}\n${o.customer.phone}${o.customer.altPhone ? ", " + o.customer.altPhone : ""}\n${o.delivery.address}${o.delivery.address ? ", " : ""}${o.delivery.city}\nCOD: ${money(o.due)}`);
    toast("Copied for courier");
  };

  const cost = o.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
  const profit = o.subtotal - o.discount - cost;
  const cancelled = o.status === "cancelled";
  const stepIdx = FLOW.indexOf(o.status as OrderStatus);

  return (
    <>
      <PageHeader
        back="/sales"
        title={
          <span className="flex flex-wrap items-center gap-3">
            Sale #{o.orderNo} <StatusBadge status={o.status} />
          </span>
        }
        subtitle={`${fmtDate(o.saleDate)}${o.source ? ` · via ${o.source}` : ""} · created ${fmtDate(o.createdAt, true)}`}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => window.print()} className="hidden sm:inline-flex"><Printer className="size-4" /> Print</Button>
            <Button variant="secondary" href={`/sales/${id}/edit`}><Pencil className="size-4" /> Edit</Button>
            <Button variant="ghost" onClick={remove} className="text-red-600 hover:bg-red-50" title="Delete"><Trash2 className="size-4" /></Button>
          </div>
        }
      />

      <Card className="no-print mb-6">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          {cancelled ? (
            <p className="text-sm text-red-700">This sale is cancelled. Its items were returned to inventory and it isn&apos;t counted in reports.</p>
          ) : (
            <ol className="grid flex-1 gap-2 sm:flex sm:items-center">
              {FLOW.map((s, i) => {
                const done = i <= stepIdx;
                return (
                  <li key={s} className="flex flex-1 items-center gap-2">
                    <button
                      onClick={() => s !== o.status && setStatus(s)}
                      disabled={!!busy}
                      className={cx(
                        "flex w-full items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors sm:w-auto",
                        done ? "bg-ink text-gold-50" : "border border-line bg-white text-stone-600 hover:border-gold-300"
                      )}
                    >
                      <span className={cx("grid size-5 place-items-center rounded-full text-[11px]", done ? "gold-fill text-espresso" : "bg-ivory")}>
                        {done ? <Check className="size-3" /> : i + 1}
                      </span>
                      {STATUS_LABEL[s]}
                    </button>
                    {i < FLOW.length - 1 && <span className={cx("hidden h-px flex-1 sm:block", i < stepIdx ? "bg-gold-400" : "bg-line")} />}
                  </li>
                );
              })}
            </ol>
          )}
          {cancelled ? (
            <Button variant="secondary" loading={busy === "packaging"} onClick={() => setStatus("packaging")}><RotateCcw className="size-4" /> Re-open sale</Button>
          ) : (
            <Button variant="ghost" loading={busy === "cancelled"} onClick={() => setStatus("cancelled")} className="text-red-600 hover:bg-red-50"><XCircle className="size-4" /> Cancel sale</Button>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card title={`Items (${o.items.reduce((s, i) => s + i.quantity, 0)} pcs)`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Product</th>
                    <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                    <th className="px-3 py-2.5 text-right font-medium">Price</th>
                    <th className="px-3 py-2.5 text-right font-medium">Total</th>
                    <th className="no-print px-5 py-2.5 text-right font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {o.items.map((i) => (
                    <tr key={i.product}>
                      <td className="px-5 py-3">
                        <Link href={`/inventory/${i.product}`} className="font-medium hover:underline">{i.name}</Link>
                        <p className="text-xs text-stone-500">{i.code} · {i.genreName}{i.categoryName && ` / ${i.categoryName}`}</p>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{i.quantity}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{money(i.unitPrice)}</td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">{money(i.quantity * i.unitPrice)}</td>
                      <td className="no-print px-5 py-3 text-right tabular-nums text-stone-600">
                        {money(i.quantity * (i.unitPrice - i.unitCost))}
                        <p className="text-xs text-stone-400">cost {money(i.unitCost)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card title="Customer" action={<button onClick={copyAddress} className="no-print rounded p-1 text-stone-400 hover:text-stone-800" title="Copy for courier"><Copy className="size-4" /></button>}>
              <div className="space-y-1 p-5 text-sm">
                <p className="font-medium">{o.customer.name}</p>
                <p><a href={`tel:${o.customer.phone}`} className="text-gold-700">{o.customer.phone}</a></p>
                {o.customer.altPhone && <p className="text-stone-600">Alt: {o.customer.altPhone}</p>}
              </div>
            </Card>
            <Card title="Delivery">
              <div className="space-y-1 p-5 text-sm">
                <p className="font-medium">{o.delivery.city}</p>
                {o.delivery.address && <p className="whitespace-pre-wrap text-stone-600">{o.delivery.address}</p>}
                {(o.courier.name || o.courier.trackingId) && (
                  <p className="pt-2 text-stone-600">
                    {o.courier.name || "Courier"}
                    {o.courier.trackingId && <> · <span className="font-mono text-xs">{o.courier.trackingId}</span></>}
                  </p>
                )}
              </div>
            </Card>
          </div>
          {o.notes && (
            <Card title="Notes">
              <p className="whitespace-pre-wrap p-5 text-sm text-stone-700">{o.notes}</p>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Payment" action={<PaymentBadge due={o.due} total={o.total} />}>
            <dl className="space-y-2 p-5 text-sm">
              <Row k="Products" v={money(o.subtotal)} />
              {o.discount > 0 && <Row k="Discount" v={`− ${money(o.discount)}`} />}
              <Row
                k={<>Delivery charge {!o.deliveryChargeCollected && <Badge>shop pays</Badge>}</>}
                v={o.deliveryChargeCollected ? money(o.deliveryCharge) : <span className="text-stone-400 line-through">{money(o.deliveryCharge)}</span>}
              />
              <div className="border-t border-stone-100 pt-2">
                <Row k="Customer pays" v={money(o.total)} bold />
              </div>
              <Row k={`Paid · ${o.paymentMethod}`} v={money(o.amountPaid)} />
              <Row k="Pending" v={money(o.due)} bold className={o.due > 0 ? "text-red-600" : "text-emerald-700"} />
            </dl>
            <div className="no-print flex gap-2 border-t border-stone-100 p-4">
              {o.due > 0 && <Button size="sm" loading={busy === "pay"} onClick={markPaid}>Mark fully paid</Button>}
              <Button size="sm" variant="secondary" onClick={() => { setPayAmt(String(o.amountPaid)); setPayErr(null); setPayOpen(true); }}>Change paid amount</Button>
            </div>
          </Card>

          <Card title="Profit" className="no-print">
            <dl className="space-y-2 p-5 text-sm">
              <Row k="Sold for (after discount)" v={money(o.subtotal - o.discount)} />
              <Row k="Buying cost" v={`− ${money(cost)}`} />
              <Row k="Profit" v={money(profit)} bold className={profit < 0 ? "text-red-600" : "text-emerald-700"} />
              <p className="pt-1 text-xs text-stone-400">Delivery charge is not included in profit.{cancelled && " Cancelled sales don't count in reports."}</p>
            </dl>
          </Card>

          <Card title="Status history" className="no-print">
            <ol className="space-y-3 p-5">
              {[...o.statusHistory].reverse().map((h, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <StatusBadge status={h.status} />
                  <span className="text-xs text-stone-500">{fmtDate(h.at, true)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Change paid amount">
        <form onSubmit={savePay} className="space-y-4">
          <Field label="Total paid by customer (৳)" hint={`Customer pays ${money(o.total)} in total`}>
            <Input type="number" min={0} max={o.total} step="0.01" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} autoFocus required />
          </Field>
          <ErrorBox error={payErr} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Row({ k, v, bold, className }: { k: React.ReactNode; v: React.ReactNode; bold?: boolean; className?: string }) {
  return (
    <div className={cx("flex items-center justify-between gap-4", bold && "font-semibold", className)}>
      <dt className={cx("flex items-center gap-1.5", !className && "text-stone-600")}>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
