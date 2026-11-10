import { route, HttpError } from "@/lib/api";
import { parseExpense } from "@/lib/expenses";
import { Expense } from "@/lib/models";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const e = await Expense.findByIdAndUpdate(id, await parseExpense(await req.json()), { returnDocument: "after" }).catch(() => null);
  if (!e) throw new HttpError(404, "Expense not found");
  return { ok: true };
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const e = await Expense.findByIdAndDelete(id).catch(() => null);
  if (!e) throw new HttpError(404, "Expense not found");
  return { ok: true };
});
