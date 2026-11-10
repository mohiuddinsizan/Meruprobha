import { route, bad, str } from "@/lib/api";
import { ensureExpenseCategories } from "@/lib/expenses";
import { Expense, ExpenseCategory } from "@/lib/models";

export const GET = route(async () => {
  await ensureExpenseCategories();
  const [cats, used] = await Promise.all([
    ExpenseCategory.find().sort({ name: 1 }).lean(),
    Expense.aggregate([{ $group: { _id: "$category", n: { $sum: 1 } } }]),
  ]);
  const count = new Map(used.map((u) => [String(u._id), u.n]));
  return cats.map((c) => ({ _id: String(c._id), name: c.name, count: count.get(String(c._id)) ?? 0 }));
});

export const POST = route(async (req) => {
  const name = str((await req.json()).name, 60);
  if (!name) throw bad("Name is required");
  const c = await ExpenseCategory.create({ name, key: name.toLowerCase() });
  return { _id: String(c._id), name: c.name };
});
