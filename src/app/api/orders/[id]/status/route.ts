import { route, HttpError, bad } from "@/lib/api";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";
import { Order } from "@/lib/models";
import { applyStock, qtyByProduct, withTxn } from "@/lib/orders";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { status } = (await req.json()) as { status: OrderStatus };
  if (!ORDER_STATUSES.includes(status)) throw bad("Invalid status");

  await withTxn(async (session) => {
    const o = await Order.findById(id).session(session).catch(() => null);
    if (!o) throw new HttpError(404, "Order not found");
    if (o.status === status) return;

    const qty = qtyByProduct(o.items);
    if (status === "cancelled" && o.stockApplied) {
      await applyStock(qty, session, { type: "cancel", orderId: o._id, orderNo: o.orderNo, note: "Order cancelled, stock returned" });
      o.stockApplied = false;
    } else if (status !== "cancelled" && !o.stockApplied) {
      const deduct = new Map([...qty].map(([pid, q]) => [pid, -q]));
      await applyStock(deduct, session, { type: "reactivate", orderId: o._id, orderNo: o.orderNo, note: "Cancelled order re-opened" });
      o.stockApplied = true;
    }
    o.status = status;
    o.statusHistory.push({ status, at: new Date() });
    await o.save({ session });
  });
  return { ok: true };
});
