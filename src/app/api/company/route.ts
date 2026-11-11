import { route } from "@/lib/api";
import { todayYmd } from "@/lib/dates";
import { Ledger, Order, User } from "@/lib/models";
import { preview } from "@/lib/money";
import { round } from "@/lib/orders";
import { publicUser } from "@/lib/users";

export const GET = route(async () => {
  const [now, due, users, last, count] = await Promise.all([
    preview(todayYmd()),
    Order.aggregate([{ $match: { status: { $ne: "cancelled" }, due: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: "$due" } } }]),
    User.find({ active: true }).sort({ role: -1, createdAt: 1 }).lean(),
    Ledger.findOne({ type: "distribution", reversed: null }).sort({ createdAt: -1 }).lean(),
    Ledger.countDocuments({ type: "distribution", reversed: null }),
  ]);
  return {
    ...now,
    balance: now.available,
    pendingPayments: round(due[0]?.total ?? 0),
    accounts: users.map(publicUser),
    lastShares: last?.shares.map((s) => ({ user: String(s.user), pct: s.pct })) ?? [],
    lastAt: last?.createdAt ?? null,
    distributions: count,
  };
});
