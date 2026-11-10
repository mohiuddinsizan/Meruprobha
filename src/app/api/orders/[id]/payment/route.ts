import { route, HttpError, bad, nonNeg } from "@/lib/api";
import { Order } from "@/lib/models";
import { round } from "@/lib/orders";

type Ctx = { params: Promise<{ id: string }> };

/** Quick payment update: { amountPaid } or { markPaid: true }. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const b = await req.json();
  const o = await Order.findById(id).catch(() => null);
  if (!o) throw new HttpError(404, "Order not found");
  const paid = b.markPaid ? o.total : nonNeg(b.amountPaid, "Paid amount")!;
  if (paid > o.total) throw bad("Paid amount can't be more than the total payable");
  o.amountPaid = paid;
  o.due = round(o.total - paid);
  await o.save();
  return { ok: true };
});
