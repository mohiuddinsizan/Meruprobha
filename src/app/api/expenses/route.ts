import mongoose from "mongoose";
import { route } from "@/lib/api";
import { addDays, dayStart, isYmd } from "@/lib/dates";
import { parseExpense } from "@/lib/expenses";
import { Expense } from "@/lib/models";

export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  const filter: Record<string, unknown> = {};
  const from = sp.get("from");
  const to = sp.get("to");
  if (isYmd(from) || isYmd(to)) {
    filter.date = {
      ...(isYmd(from) ? { $gte: dayStart(from) } : {}),
      ...(isYmd(to) ? { $lt: dayStart(addDays(to, 1)) } : {}),
    };
  }
  if (mongoose.isValidObjectId(sp.get("category"))) filter.category = new mongoose.Types.ObjectId(sp.get("category")!);

  const [expenses, byCategory] = await Promise.all([
    Expense.find(filter).sort({ date: -1, createdAt: -1 }).limit(2000).lean(),
    Expense.aggregate([
      { $match: filter },
      { $group: { _id: "$category", name: { $last: "$categoryName" }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
  ]);
  const total = byCategory.reduce((s, c) => s + c.total, 0);
  return { expenses, total: Math.round(total * 100) / 100, byCategory: byCategory.map((c) => ({ ...c, _id: String(c._id) })) };
});

export const POST = route(async (req) => {
  const e = await Expense.create(await parseExpense(await req.json()));
  return { _id: String(e._id) };
});
