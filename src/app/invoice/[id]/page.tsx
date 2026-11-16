"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, Gem, Globe, Mail, MapPin, Phone, Printer } from "lucide-react";
import { useApi } from "@/lib/client";
import { STATUS_LABEL, type OrderStatus } from "@/lib/constants";
import { fmtDate, money, takaInWords } from "@/lib/format";
import type { Order, Settings } from "@/lib/types";

const A4_PX = 794; // 210mm at 96dpi

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: o, error } = useApi<Order>(`/api/orders/${id}`, { revalidateOnMount: true });
  const { data: s } = useApi<Settings>("/api/settings");
  const [zoom, setZoom] = useState(1);

  // Shrink the A4 sheet to fit phone screens; printing always uses full size.
  useEffect(() => {
    const fit = () => setZoom(Math.min(1, (window.innerWidth - 24) / A4_PX));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const shop = s?.shopName || "Meruprobha";
  useEffect(() => {
    if (o) document.title = `Invoice INV-${o.orderNo} - ${shop}`;
  }, [o, shop]);

  if (error) return <p className="p-10 text-center text-sm text-red-600">{(error as Error).message}</p>;
  if (!o || !s) return <p className="p-10 text-center text-sm text-stone-500">Loading invoice…</p>;

  const pcs = o.items.reduce((t, i) => t + i.quantity, 0);
  const cancelled = o.status === "cancelled";
  const paid = o.due <= 0;
  const stamp = cancelled
    ? { text: "Cancelled", cls: "border-red-600 text-red-600" }
    : paid
      ? { text: "Paid", cls: "border-emerald-600 text-emerald-600" }
      : o.amountPaid > 0
        ? { text: "Partially paid", cls: "border-amber-600 text-amber-600" }
        : { text: "Payment due", cls: "border-red-600 text-red-600" };

  return (
    <div className="invoice-screen min-h-screen bg-stone-200/70 py-6">
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          .invoice-screen { background: white !important; padding: 0 !important; }
          .invoice-sheet { zoom: 1 !important; box-shadow: none !important; margin: 0 !important; }
        }
        .invoice-sheet { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      <div className="no-print mx-auto mb-5 flex max-w-[794px] flex-wrap items-center justify-between gap-3 px-3">
        <Link href={`/sales/${o._id}`} className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-ink">
          <ArrowLeft className="size-4" /> Back to sale
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-stone-500 sm:inline">To save a PDF, choose &ldquo;Save as PDF&rdquo; in the print window</span>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-gold-50 shadow hover:bg-espresso">
            <Printer className="size-4" /> Print / PDF
          </button>
        </div>
      </div>

      <div
        className="invoice-sheet relative mx-auto flex min-h-[1123px] w-[794px] flex-col overflow-hidden bg-white text-[13px] leading-relaxed text-ink shadow-xl"
        style={{ zoom }}
      >
        <div className="gold-fill h-2 w-full" />

        {cancelled && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="-rotate-[30deg] font-display text-[120px] font-bold uppercase tracking-[0.08em] text-red-600/10">Cancelled</span>
          </div>
        )}

        <div className="flex flex-1 flex-col px-14 pb-10 pt-10">
          {/* Shop + invoice title */}
          <div className="flex items-start justify-between gap-8">
            <div className="flex gap-4">
              <span className="gold-fill grid size-14 shrink-0 place-items-center rounded-full text-espresso ring-1 ring-gold-200">
                <Gem className="size-6" strokeWidth={1.6} />
              </span>
              <div>
                <p className="font-display text-[34px] font-semibold leading-none tracking-wide text-ink">{shop}</p>
                <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.35em] text-gold-600">Fine Jewellery</p>
                <div className="mt-3 space-y-0.5 text-[12px] text-stone-600">
                  {s.shopAddress && <p className="flex items-start gap-1.5"><MapPin className="mt-[3px] size-3 shrink-0 text-gold-600" /><span className="whitespace-pre-line">{s.shopAddress}</span></p>}
                  {s.shopPhone && <p className="flex items-center gap-1.5"><Phone className="size-3 text-gold-600" />{s.shopPhone}</p>}
                  {s.shopEmail && <p className="flex items-center gap-1.5"><Mail className="size-3 text-gold-600" />{s.shopEmail}</p>}
                  {s.shopWebsite && <p className="flex items-center gap-1.5"><Globe className="size-3 text-gold-600" />{s.shopWebsite}</p>}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-[44px] font-semibold uppercase leading-none tracking-[0.12em] text-gold-600">Invoice</p>
              <dl className="mt-4 grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-1 text-[12px]">
                <dt className="text-stone-500">Invoice no.</dt>
                <dd className="font-semibold tabular-nums">INV-{o.orderNo}</dd>
                <dt className="text-stone-500">Invoice date</dt>
                <dd className="font-medium">{fmtDate(o.saleDate)}</dd>
                <dt className="text-stone-500">Order status</dt>
                <dd className="font-medium">{STATUS_LABEL[o.status as OrderStatus] ?? o.status}</dd>
              </dl>
            </div>
          </div>

          <div className="hairline-gold my-7 h-px" />

          {/* Parties */}
          <div className="grid grid-cols-3 gap-8">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-600">Billed to</p>
              <p className="text-[14px] font-semibold">{o.customer.name}</p>
              <p className="text-stone-600">{o.customer.phone}</p>
              {o.customer.altPhone && <p className="text-stone-600">{o.customer.altPhone}</p>}
            </div>
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-600">Deliver to</p>
              {o.delivery.address && <p className="whitespace-pre-line text-stone-700">{o.delivery.address}</p>}
              <p className="font-medium">{o.delivery.city}, Bangladesh</p>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-600">Payment &amp; shipping</p>
              <p className="text-stone-700">Method: <span className="font-medium text-ink">{o.paymentMethod}</span></p>
              {o.courier.name && <p className="text-stone-700">Courier: <span className="font-medium text-ink">{o.courier.name}</span></p>}
              {o.courier.trackingId && <p className="text-stone-700">Tracking: <span className="font-mono text-[12px] text-ink">{o.courier.trackingId}</span></p>}
            </div>
          </div>

          {/* Items */}
          <table className="mt-8 w-full border-collapse">
            <thead>
              <tr className="bg-ink text-left text-[10.5px] uppercase tracking-[0.15em] text-gold-100">
                <th className="w-10 py-3 pl-4 font-medium">#</th>
                <th className="py-3 pr-3 font-medium">Item description</th>
                <th className="w-16 py-3 pr-3 text-center font-medium">Qty</th>
                <th className="w-28 py-3 pr-3 text-right font-medium">Unit price</th>
                <th className="w-28 py-3 pr-4 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {o.items.map((i, n) => (
                <tr key={i.product + n} className="border-b border-line align-top odd:bg-white even:bg-gold-50/60">
                  <td className="py-3 pl-4 tabular-nums text-stone-500">{String(n + 1).padStart(2, "0")}</td>
                  <td className="py-3 pr-3">
                    <p className="font-medium">{i.name}</p>
                    <p className="text-[11px] text-stone-500">
                      Code {i.code}
                      {i.genreName && ` · ${i.genreName}`}
                      {i.categoryName && ` / ${i.categoryName}`}
                    </p>
                  </td>
                  <td className="py-3 pr-3 text-center tabular-nums">{i.quantity}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{money(i.unitPrice)}</td>
                  <td className="py-3 pr-4 text-right font-medium tabular-nums">{money(i.quantity * i.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-right text-[11px] text-stone-500">{o.items.length} item{o.items.length === 1 ? "" : "s"} · {pcs} piece{pcs === 1 ? "" : "s"}</p>

          {/* Totals */}
          <div className="mt-6 grid grid-cols-[1fr_300px] gap-10">
            <div className="space-y-5">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-600">Amount in words</p>
                <p className="font-medium italic text-stone-700">{takaInWords(o.total)}</p>
              </div>
              {o.notes && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-600">Note</p>
                  <p className="whitespace-pre-line text-stone-700">{o.notes}</p>
                </div>
              )}
              <div className={`inline-block -rotate-6 rounded-md border-[3px] px-4 py-1.5 font-display text-2xl font-bold uppercase tracking-[0.2em] opacity-80 ${stamp.cls}`}>
                {stamp.text}
              </div>
            </div>

            <dl className="text-[13px]">
              <Line k="Subtotal" v={money(o.subtotal)} />
              {o.discount > 0 && <Line k="Discount" v={`− ${money(o.discount)}`} />}
              <Line
                k={`Delivery charge${o.delivery.city ? ` (${o.delivery.city === "Dhaka" ? "inside" : "outside"} Dhaka)` : ""}`}
                v={o.deliveryChargeCollected && o.deliveryCharge > 0 ? money(o.deliveryCharge) : "Free"}
              />
              <div className="my-2 flex items-center justify-between bg-ink px-4 py-3 text-gold-50">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.18em]">Grand total</dt>
                <dd className="font-display text-[22px] font-semibold tabular-nums">{money(o.total)}</dd>
              </div>
              <Line k="Paid" v={money(o.amountPaid)} />
              {cancelled ? (
                <Line k="Order cancelled" v="Nothing to collect" strong className="text-stone-500" />
              ) : (
              <Line
                k={o.due > 0 && o.paymentMethod === "Cash on Delivery" ? "Collect on delivery" : "Balance due"}
                v={money(o.due)}
                strong
                className={o.due > 0 ? "text-red-700" : "text-emerald-700"}
              />
              )}
            </dl>
          </div>

          <div className="flex-1" />

          {/* Signatures */}
          <div className="mt-16 grid grid-cols-2 gap-24 text-[11px] text-stone-500">
            <div className="border-t border-stone-400 pt-1.5 text-center">Customer signature</div>
            <div className="border-t border-stone-400 pt-1.5 text-center">Authorised signature · {shop}</div>
          </div>

          {/* Footer */}
          <div className="mt-8 border-t border-line pt-5 text-center">
            <p className="font-display text-[20px] font-semibold text-ink">Thank you for shopping with {shop}</p>
            {s.invoiceNote && <p className="mx-auto mt-1 max-w-[560px] whitespace-pre-line text-[11.5px] text-stone-600">{s.invoiceNote}</p>}
            <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-stone-400">This is a computer-generated invoice</p>
          </div>
        </div>
        <div className="gold-fill h-1 w-full" />
      </div>
    </div>
  );
}

function Line({ k, v, strong, className }: { k: string; v: string; strong?: boolean; className?: string }) {
  return (
    <div className={`flex items-center justify-between border-b border-line px-1 py-2 ${strong ? "font-semibold" : ""} ${className ?? ""}`}>
      <dt className={className ? "" : "text-stone-600"}>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
