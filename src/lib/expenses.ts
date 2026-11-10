import mongoose from "mongoose";
import { bad, nonNeg, str } from "./api";
import { DEFAULT_EXPENSE_CATEGORIES } from "./constants";
import { dayStart, isYmd } from "./dates";
import { ExpenseCategory } from "./models";

export async function ensureExpenseCategories() {
  if (await ExpenseCategory.exists({})) return;
  await ExpenseCategory.insertMany(DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ name, key: name.toLowerCase() })), { ordered: false }).catch(() => {});
}

export async function parseExpense(b: Record<string, unknown>) {
  if (!isYmd(b.date)) throw bad("Select a date");
  if (!mongoose.isValidObjectId(b.category)) throw bad("Select an expense category");
  const cat = await ExpenseCategory.findById(String(b.category));
  if (!cat) throw bad("Select an expense category");
  const amount = nonNeg(b.amount, "Amount")!;
  if (amount <= 0) throw bad("Amount must be more than 0");
  return {
    // Stored at noon Dhaka time so the calendar day never shifts.
    date: new Date(dayStart(b.date).getTime() + 12 * 3600 * 1000),
    category: cat._id,
    categoryName: cat.name,
    amount,
    note: str(b.note, 500),
  };
}
