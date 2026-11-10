import { route, bad, str, HttpError } from "@/lib/api";
import { Expense, ExpenseCategory } from "@/lib/models";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const name = str((await req.json()).name, 60);
  if (!name) throw bad("Name is required");
  const c = await ExpenseCategory.findByIdAndUpdate(id, { name, key: name.toLowerCase() }, { returnDocument: "after" }).catch(() => null);
  if (!c) throw new HttpError(404, "Not found");
  await Expense.updateMany({ category: c._id }, { categoryName: c.name });
  return { _id: String(c._id), name: c.name };
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const used = await Expense.countDocuments({ category: id }).catch(() => 0);
  if (used) throw bad(`${used} expense(s) use this category. Change or delete them first.`);
  const c = await ExpenseCategory.findByIdAndDelete(id).catch(() => null);
  if (!c) throw new HttpError(404, "Not found");
  return { ok: true };
});
