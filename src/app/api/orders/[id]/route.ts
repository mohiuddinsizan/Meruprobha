import { route, HttpError } from "@/lib/api";
import { Order } from "@/lib/models";
import { applyStock, parseOrder, qtyByProduct, withTxn } from "@/lib/orders";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const o = await Order.findById(id).lean().catch(() => null);
  if (!o) throw new HttpError(404, "Order not found");
  return o;
});

/** Full edit. Stock is adjusted by the net difference between old and new items. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  await withTxn(async (session) => {
    const o = await Order.findById(id).session(session).catch(() => null);
    if (!o) throw new HttpError(404, "Order not found");
    const { fields } = await parseOrder(body, o); // status is changed only via /status

    const deltas = new Map<string, number>();
    if (o.stockApplied) {
      for (const [pid, q] of qtyByProduct(o.items)) deltas.set(pid, (deltas.get(pid) ?? 0) + q);
      for (const [pid, q] of qtyByProduct(fields.items)) deltas.set(pid, (deltas.get(pid) ?? 0) - q);
    }
    // Return stock before taking, so swapping products never fails spuriously.
    const sorted = new Map([...deltas].sort((a, b) => b[1] - a[1]));
    await applyStock(sorted, session, { type: "sale_edit", orderId: o._id, orderNo: o.orderNo, note: "Order edited" });

    o.set(fields);
    await o.save({ session });
  });
  return { ok: true };
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await withTxn(async (session) => {
    const o = await Order.findById(id).session(session).catch(() => null);
    if (!o) throw new HttpError(404, "Order not found");
    if (o.stockApplied) {
      await applyStock(qtyByProduct(o.items), session, { type: "order_deleted", orderId: o._id, orderNo: o.orderNo, note: "Order deleted, stock returned" });
    }
    await o.deleteOne({ session });
  });
  return { ok: true };
});
