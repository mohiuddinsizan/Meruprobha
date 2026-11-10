import { route } from "@/lib/api";
import { getSettings } from "@/lib/auth";
import { todayYmd } from "@/lib/dates";
import { Order, Product } from "@/lib/models";
import { buildReport } from "@/lib/report";

export const GET = route(async () => {
  const today = todayYmd();
  const monthStart = today.slice(0, 8) + "01";
  const { lowStockThreshold } = await getSettings();

  const [todayR, monthR, stock, lowStock, recent, pending, dueAgg] = await Promise.all([
    buildReport({ from: today, to: today }),
    buildReport({ from: monthStart, to: today }),
    Product.aggregate([
      { $match: { archived: false } },
      {
        $group: {
          _id: null,
          products: { $sum: 1 },
          units: { $sum: "$quantity" },
          costValue: { $sum: { $multiply: ["$quantity", "$buyingPrice"] } },
          outOfStock: { $sum: { $cond: [{ $eq: ["$quantity", 0] }, 1, 0] } },
        },
      },
    ]),
    Product.find({ archived: false, quantity: { $lte: lowStockThreshold } }).select("name code quantity images").sort({ quantity: 1 }).limit(8).lean(),
    Order.find().select("orderNo saleDate customer.name total status due").sort({ saleDate: -1, orderNo: -1 }).limit(8).lean(),
    Order.aggregate([{ $match: { status: { $in: ["packaging", "out_for_delivery"] } } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { status: { $ne: "cancelled" }, due: { $gt: 0 } } }, { $group: { _id: null, n: { $sum: 1 }, due: { $sum: "$due" } } }]),
  ]);

  return {
    today: todayR.summary,
    month: { ...monthR.summary, timeline: monthR.timeline },
    stock: stock[0] ?? { products: 0, units: 0, costValue: 0, outOfStock: 0 },
    lowStockThreshold,
    lowStock,
    recent,
    pending: Object.fromEntries(pending.map((p) => [p._id, p.n])),
    dues: dueAgg[0] ?? { n: 0, due: 0 },
  };
});
