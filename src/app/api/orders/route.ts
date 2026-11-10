import { route } from "@/lib/api";
import { ORDER_STATUSES } from "@/lib/constants";
import { addDays, dayStart, isYmd } from "@/lib/dates";
import { Order, nextSeq } from "@/lib/models";
import { applyStock, parseOrder, qtyByProduct, withTxn } from "@/lib/orders";

export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  const base: Record<string, unknown> = {};
  const from = sp.get("from");
  const to = sp.get("to");
  if (isYmd(from) || isYmd(to)) {
    base.saleDate = {
      ...(isYmd(from) ? { $gte: dayStart(from) } : {}),
      ...(isYmd(to) ? { $lt: dayStart(addDays(to, 1)) } : {}),
    };
  }
  const q = sp.get("q")?.trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const n = Number(q.replace(/^#/, ""));
    base.$or = [{ "customer.name": rx }, { "customer.phone": rx }, ...(Number.isInteger(n) && n > 0 ? [{ orderNo: n }] : [])];
  }
  if (sp.get("due") === "1") base.due = { $gt: 0 };

  const filter = { ...base };
  const status = sp.get("status");
  if (status && (ORDER_STATUSES as readonly string[]).includes(status)) filter.status = status;

  const limit = Math.min(Number(sp.get("limit")) || 50, 5000);
  const page = Math.max(Number(sp.get("page")) || 1, 1);
  const [orders, total, counts] = await Promise.all([
    Order.find(filter).select("-statusHistory").sort({ saleDate: -1, orderNo: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
    Order.aggregate([{ $match: base }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  return { orders, total, page, limit, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) };
});

export const POST = route(async (req) => {
  const { fields, status } = await parseOrder(await req.json());
  const applied = status !== "cancelled";
  const order = await withTxn(async (session) => {
    const orderNo = 1000 + (await nextSeq("order", session));
    const [o] = await Order.create(
      [{ ...fields, orderNo, status, stockApplied: applied, statusHistory: [{ status, at: new Date() }] }],
      { session }
    );
    if (applied) {
      const deltas = new Map([...qtyByProduct(fields.items)].map(([id, q]) => [id, -q]));
      await applyStock(deltas, session, { type: "sale", orderId: o._id, orderNo, note: "Sold" });
    }
    return o;
  });
  return { _id: String(order._id), orderNo: order.orderNo };
});
