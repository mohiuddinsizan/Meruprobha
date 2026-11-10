import { addDays, dayStart, toYmd, todayYmd, TZ } from "./dates";
import { Category, Expense, Order } from "./models";

export type Granularity = "day" | "month" | "year";

const r2 = (n: number) => Math.round((n ?? 0) * 100) / 100;

function pickGranularity(from: string, to: string): Granularity {
  const days = (dayStart(to).getTime() - dayStart(from).getTime()) / 86400000;
  if (days <= 62) return "day";
  if (days <= 366 * 3) return "month";
  return "year";
}

function buckets(from: string, to: string, g: Granularity): string[] {
  const out: string[] = [];
  if (g === "day") {
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  } else if (g === "month") {
    let [y, m] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    while (y < ty || (y === ty && m <= tm)) {
      out.push(`${y}-${String(m).padStart(2, "0")}`);
      if (++m > 12) { m = 1; y++; }
    }
  } else {
    for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) out.push(String(y));
  }
  return out;
}

/**
 * Sales report for [from, to] (Dhaka calendar days, inclusive). Revenue uses the
 * price entered on each sale; cost uses the buying price captured at sale time.
 * Delivery charges are reported separately and never count toward profit.
 */
export async function buildReport(opts: { from?: string; to?: string; deliveredOnly?: boolean }) {
  let { from, to } = opts;
  if (!to) to = todayYmd();
  if (!from) {
    const [firstOrder, firstExpense] = await Promise.all([
      Order.findOne().sort({ saleDate: 1 }).select("saleDate").lean(),
      Expense.findOne().sort({ date: 1 }).select("date").lean(),
    ]);
    const firsts = [firstOrder?.saleDate, firstExpense?.date].filter(Boolean).map((d) => toYmd(d!));
    from = firsts.length ? firsts.sort()[0] : to;
  }
  if (from > to) [from, to] = [to, from];
  const g = pickGranularity(from, to);
  const fmt = g === "day" ? "%Y-%m-%d" : g === "month" ? "%Y-%m" : "%Y";
  const range = { $gte: dayStart(from), $lt: dayStart(addDays(to, 1)) };

  const match = { saleDate: range, status: opts.deliveredOnly ? "delivered" : { $ne: "cancelled" } };
  const lineNet = {
    $let: {
      vars: { line: { $multiply: ["$items.quantity", "$items.unitPrice"] } },
      in: {
        $subtract: [
          "$$line",
          { $cond: [{ $gt: ["$subtotal", 0] }, { $multiply: ["$discount", { $divide: ["$$line", "$subtotal"] }] }, 0] },
        ],
      },
    },
  };
  const lineCost = { $multiply: ["$items.quantity", "$items.unitCost"] };

  const [res] = await Order.aggregate([
    { $match: match },
    {
      $addFields: {
        net: { $subtract: ["$subtotal", "$discount"] },
        cost: { $sum: { $map: { input: "$items", in: { $multiply: ["$$this.quantity", "$$this.unitCost"] } } } },
        qty: { $sum: "$items.quantity" },
      },
    },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              orders: { $sum: 1 },
              itemsSold: { $sum: "$qty" },
              gross: { $sum: "$subtotal" },
              discount: { $sum: "$discount" },
              net: { $sum: "$net" },
              cost: { $sum: "$cost" },
              deliveryCharge: { $sum: "$deliveryCharge" },
              deliveryCollected: { $sum: { $cond: ["$deliveryChargeCollected", "$deliveryCharge", 0] } },
              deliveryNotCollected: { $sum: { $cond: ["$deliveryChargeCollected", 0, "$deliveryCharge"] } },
              billed: { $sum: "$total" },
              received: { $sum: "$amountPaid" },
              due: { $sum: "$due" },
            },
          },
        ],
        timeline: [
          {
            $group: {
              _id: { $dateToString: { format: fmt, date: "$saleDate", timezone: TZ } },
              orders: { $sum: 1 },
              net: { $sum: "$net" },
              cost: { $sum: "$cost" },
            },
          },
        ],
        byPayment: [{ $group: { _id: "$paymentMethod", orders: { $sum: 1 }, billed: { $sum: "$total" }, received: { $sum: "$amountPaid" } } }, { $sort: { billed: -1 } }],
        byCity: [{ $group: { _id: "$delivery.city", orders: { $sum: 1 }, net: { $sum: "$net" } } }, { $sort: { net: -1 } }, { $limit: 10 }],
        bySource: [{ $group: { _id: "$source", orders: { $sum: 1 }, net: { $sum: "$net" } } }, { $sort: { net: -1 } }],
        byProduct: [
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.product",
              name: { $last: "$items.name" },
              code: { $last: "$items.code" },
              qty: { $sum: "$items.quantity" },
              net: { $sum: lineNet },
              cost: { $sum: lineCost },
            },
          },
          { $sort: { net: -1 } },
          { $limit: 25 },
        ],
        byGenre: [
          { $unwind: "$items" },
          { $group: { _id: "$items.genre", name: { $last: "$items.genreName" }, qty: { $sum: "$items.quantity" }, net: { $sum: lineNet }, cost: { $sum: lineCost } } },
          { $sort: { net: -1 } },
        ],
      },
    },
  ]);

  const [statusCounts, cancelled, expAgg] = await Promise.all([
    Order.aggregate([{ $match: { saleDate: range } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { saleDate: range, status: "cancelled" } }, { $group: { _id: null, n: { $sum: 1 }, value: { $sum: { $subtract: ["$subtotal", "$discount"] } } } }]),
    Expense.aggregate([
      { $match: { date: range } },
      {
        $facet: {
          byCategory: [{ $group: { _id: "$category", name: { $last: "$categoryName" }, total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { total: -1 } }],
          timeline: [{ $group: { _id: { $dateToString: { format: fmt, date: "$date", timezone: TZ } }, total: { $sum: "$amount" } } }],
        },
      },
    ]),
  ]);
  const expByCategory: { _id: unknown; name: string; total: number; count: number }[] = expAgg[0]?.byCategory ?? [];
  const expenses = r2(expByCategory.reduce((a, c) => a + c.total, 0));
  const expTl = new Map<string, number>((expAgg[0]?.timeline ?? []).map((t: { _id: string; total: number }) => [t._id, t.total]));

  const s = res.summary[0] ?? {};
  const net = r2(s.net), cost = r2(s.cost);
  const summary = {
    orders: s.orders ?? 0,
    itemsSold: s.itemsSold ?? 0,
    gross: r2(s.gross),
    discount: r2(s.discount),
    net,
    cost,
    profit: r2(net - cost),
    margin: net > 0 ? r2(((net - cost) / net) * 100) : 0,
    expenses,
    netProfit: r2(net - cost - expenses),
    netMargin: net > 0 ? r2(((net - cost - expenses) / net) * 100) : 0,
    avgOrder: s.orders ? r2(net / s.orders) : 0,
    deliveryCharge: r2(s.deliveryCharge),
    deliveryCollected: r2(s.deliveryCollected),
    deliveryNotCollected: r2(s.deliveryNotCollected),
    billed: r2(s.billed),
    received: r2(s.received),
    due: r2(s.due),
    cancelledOrders: cancelled[0]?.n ?? 0,
    cancelledValue: r2(cancelled[0]?.value ?? 0),
  };

  const tl = new Map<string, { orders: number; net: number; cost: number }>(res.timeline.map((t: { _id: string; orders: number; net: number; cost: number }) => [t._id, t]));
  const timeline = buckets(from, to, g).map((b) => {
    const t = tl.get(b);
    const profit = (t?.net ?? 0) - (t?.cost ?? 0);
    const exp = expTl.get(b) ?? 0;
    return { bucket: b, orders: t?.orders ?? 0, sales: r2(t?.net ?? 0), profit: r2(profit), expenses: r2(exp), netProfit: r2(profit - exp) };
  });

  const genreNames = new Map((await Category.find({ parent: null }).lean()).map((c) => [String(c._id), c.name]));
  const withProfit = <T extends { net: number; cost: number }>(x: T) => ({ ...x, net: r2(x.net), cost: r2(x.cost), profit: r2(x.net - x.cost) });

  return {
    from,
    to,
    granularity: g,
    deliveredOnly: !!opts.deliveredOnly,
    summary,
    timeline,
    statusCounts: Object.fromEntries(statusCounts.map((c) => [c._id, c.n])),
    byGenre: res.byGenre.map((x: { _id: unknown; name: string; qty: number; net: number; cost: number }) => withProfit({ ...x, _id: String(x._id), name: genreNames.get(String(x._id)) ?? x.name ?? "—" })),
    byProduct: res.byProduct.map((x: { _id: unknown; name: string; code: string; qty: number; net: number; cost: number }) => withProfit({ ...x, _id: String(x._id) })),
    byPayment: res.byPayment.map((x: { _id: string; orders: number; billed: number; received: number }) => ({ method: x._id, orders: x.orders, billed: r2(x.billed), received: r2(x.received) })),
    byCity: res.byCity.map((x: { _id: string; orders: number; net: number }) => ({ city: x._id, orders: x.orders, net: r2(x.net) })),
    expensesByCategory: expByCategory.map((x) => ({ _id: String(x._id), name: x.name, total: r2(x.total), count: x.count })),
    bySource: res.bySource.map((x: { _id: string; orders: number; net: number }) => ({ source: x._id || "Not set", orders: x.orders, net: r2(x.net) })),
  };
}
