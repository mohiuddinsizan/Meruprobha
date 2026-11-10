import { addDays, dayStart, toYmd, todayYmd, TZ } from "./dates";
import { Types } from "mongoose";
import { Category, Expense, Order, Product } from "./models";

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
export async function buildReport(opts: { from?: string; to?: string; deliveredOnly?: boolean; genre?: string; category?: string }) {
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
      },
    },
  ]);

  // Item-level analysis: profit per product / genre / category, optionally scoped to one genre or category.
  const itemMatch: Record<string, unknown> = {};
  if (opts.genre && Types.ObjectId.isValid(opts.genre)) itemMatch["items.genre"] = new Types.ObjectId(opts.genre);
  if (opts.category && Types.ObjectId.isValid(opts.category)) itemMatch["items.category"] = new Types.ObjectId(opts.category);
  const scoped = Object.keys(itemMatch).length > 0;

  const [items] = await Order.aggregate([
    { $match: match },
    { $unwind: "$items" },
    ...(scoped ? [{ $match: itemMatch }] : []),
    {
      $addFields: {
        lineNet: lineNet,
        lineCost: lineCost,
        bucket: { $dateToString: { format: fmt, date: "$saleDate", timezone: TZ } },
      },
    },
    {
      $facet: {
        totals: [{ $group: { _id: null, qty: { $sum: "$items.quantity" }, net: { $sum: "$lineNet" }, cost: { $sum: "$lineCost" }, orders: { $addToSet: "$_id" } } }, { $project: { qty: 1, net: 1, cost: 1, orders: { $size: "$orders" } } }],
        timeline: [{ $group: { _id: "$bucket", net: { $sum: "$lineNet" }, cost: { $sum: "$lineCost" }, orders: { $addToSet: "$_id" } } }, { $project: { net: 1, cost: 1, orders: { $size: "$orders" } } }],
        byProduct: [
          { $group: { _id: "$items.product", name: { $last: "$items.name" }, code: { $last: "$items.code" }, genre: { $last: "$items.genre" }, category: { $last: "$items.category" }, qty: { $sum: "$items.quantity" }, net: { $sum: "$lineNet" }, cost: { $sum: "$lineCost" }, orders: { $addToSet: "$_id" } } },
          { $project: { name: 1, code: 1, genre: 1, category: 1, qty: 1, net: 1, cost: 1, orders: { $size: "$orders" } } },
          { $sort: { net: -1 } },
          { $limit: 1000 },
        ],
        byGenre: [{ $group: { _id: "$items.genre", name: { $last: "$items.genreName" }, qty: { $sum: "$items.quantity" }, net: { $sum: "$lineNet" }, cost: { $sum: "$lineCost" } } }],
        byCategory: [
          { $group: { _id: { g: "$items.genre", c: "$items.category" }, genreName: { $last: "$items.genreName" }, name: { $last: "$items.categoryName" }, qty: { $sum: "$items.quantity" }, net: { $sum: "$lineNet" }, cost: { $sum: "$lineCost" } } },
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
  const it = items.totals[0] ?? { qty: 0, net: 0, cost: 0, orders: 0 };
  // When scoped to a genre/category, sales and cost come from the matching items only.
  // Expenses are shop-wide, so they are not split across genres.
  const net = r2(scoped ? it.net : s.net), cost = r2(scoped ? it.cost : s.cost);
  const exp = scoped ? 0 : expenses;
  const summary = {
    orders: scoped ? it.orders : s.orders ?? 0,
    itemsSold: scoped ? it.qty : s.itemsSold ?? 0,
    gross: r2(s.gross),
    discount: r2(s.discount),
    net,
    cost,
    profit: r2(net - cost),
    margin: net > 0 ? r2(((net - cost) / net) * 100) : 0,
    expenses,
    netProfit: r2(net - cost - exp),
    netMargin: net > 0 ? r2(((net - cost - exp) / net) * 100) : 0,
    avgOrder: (scoped ? it.orders : s.orders) ? r2(net / (scoped ? it.orders : s.orders)) : 0,
    deliveryCharge: r2(s.deliveryCharge),
    deliveryCollected: r2(s.deliveryCollected),
    deliveryNotCollected: r2(s.deliveryNotCollected),
    billed: r2(s.billed),
    received: r2(s.received),
    due: r2(s.due),
    cancelledOrders: cancelled[0]?.n ?? 0,
    cancelledValue: r2(cancelled[0]?.value ?? 0),
  };

  const tl = new Map<string, { orders: number; net: number; cost: number }>((scoped ? items.timeline : res.timeline).map((t: { _id: string; orders: number; net: number; cost: number }) => [t._id, t]));
  const timeline = buckets(from, to, g).map((b) => {
    const t = tl.get(b);
    const profit = (t?.net ?? 0) - (t?.cost ?? 0);
    const e = scoped ? 0 : expTl.get(b) ?? 0;
    return { bucket: b, orders: t?.orders ?? 0, sales: r2(t?.net ?? 0), profit: r2(profit), expenses: r2(e), netProfit: r2(profit - e) };
  });

  const catNames = new Map((await Category.find().lean()).map((c) => [String(c._id), c.name]));
  const withProfit = <T extends { net: number; cost: number; qty: number }>(x: T) => {
    const profit = x.net - x.cost;
    return { ...x, net: r2(x.net), cost: r2(x.cost), profit: r2(profit), margin: x.net > 0 ? r2((profit / x.net) * 100) : 0, perPiece: x.qty ? r2(profit / x.qty) : 0 };
  };
  const byProfit = (a: { profit: number }, b: { profit: number }) => b.profit - a.profit;

  type Row = { _id: unknown; name: string; qty: number; net: number; cost: number };
  type ProdRow = Row & { code: string; genre: unknown; category: unknown; orders: number };
  const prodIds = (items.byProduct as ProdRow[]).map((x) => x._id);
  const prodFilter: Record<string, unknown> = { archived: false, quantity: { $gt: 0 }, _id: { $nin: prodIds } };
  if (itemMatch["items.genre"]) prodFilter.genre = itemMatch["items.genre"];
  if (itemMatch["items.category"]) prodFilter.category = itemMatch["items.category"];
  const [prodInfo, unsold] = await Promise.all([
    Product.find({ _id: { $in: prodIds as Types.ObjectId[] } }).select("quantity images archived").lean<{ _id: Types.ObjectId; quantity: number; images: Types.ObjectId[]; archived: boolean }[]>(),
    Product.aggregate([
      { $match: prodFilter },
      { $addFields: { stockValue: { $multiply: ["$quantity", "$buyingPrice"] } } },
      { $sort: { stockValue: -1 } },
      { $limit: 30 },
      { $project: { name: 1, code: 1, quantity: 1, stockValue: 1, genre: 1, image: { $arrayElemAt: ["$images", 0] }, createdAt: 1 } },
    ]),
  ]);
  const info = new Map(prodInfo.map((p) => [String(p._id), p]));

  return {
    from,
    to,
    granularity: g,
    deliveredOnly: !!opts.deliveredOnly,
    summary,
    timeline,
    statusCounts: Object.fromEntries(statusCounts.map((c) => [c._id, c.n])),
    scoped,
    byGenre: (items.byGenre as Row[]).map((x) => withProfit({ ...x, _id: String(x._id), name: catNames.get(String(x._id)) ?? x.name ?? "—" })).sort(byProfit),
    byCategory: (items.byCategory as (Omit<Row, "_id"> & { _id: { g: unknown; c: unknown }; genreName: string })[])
      .map((x) =>
        withProfit({
          _id: `${x._id.g}:${x._id.c ?? ""}`,
          genre: String(x._id.g),
          category: x._id.c ? String(x._id.c) : null,
          genreName: catNames.get(String(x._id.g)) ?? x.genreName ?? "—",
          name: x._id.c ? catNames.get(String(x._id.c)) ?? x.name ?? "—" : "No category",
          qty: x.qty,
          net: x.net,
          cost: x.cost,
        })
      )
      .sort(byProfit),
    byProduct: (items.byProduct as ProdRow[]).map((x) => {
      const p = info.get(String(x._id));
      return withProfit({
        ...x,
        _id: String(x._id),
        genre: String(x.genre),
        genreName: catNames.get(String(x.genre)) ?? "—",
        categoryName: x.category ? catNames.get(String(x.category)) ?? "" : "",
        stock: p?.quantity ?? 0,
        image: p?.images?.[0] ? String(p.images[0]) : null,
        archived: !!p?.archived,
      });
    }),
    unsold: unsold.map((u) => ({
      _id: String(u._id),
      name: u.name,
      code: u.code,
      quantity: u.quantity,
      stockValue: r2(u.stockValue),
      genreName: catNames.get(String(u.genre)) ?? "—",
      image: u.image ? String(u.image) : null,
    })),
    byPayment: res.byPayment.map((x: { _id: string; orders: number; billed: number; received: number }) => ({ method: x._id, orders: x.orders, billed: r2(x.billed), received: r2(x.received) })),
    byCity: res.byCity.map((x: { _id: string; orders: number; net: number }) => ({ city: x._id, orders: x.orders, net: r2(x.net) })),
    expensesByCategory: expByCategory.map((x) => ({ _id: String(x._id), name: x.name, total: r2(x.total), count: x.count })),
    bySource: res.bySource.map((x: { _id: string; orders: number; net: number }) => ({ source: x._id || "Not set", orders: x.orders, net: r2(x.net) })),
  };
}
