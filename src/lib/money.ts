import mongoose from "mongoose";
import { bad, HttpError, nonNeg, str } from "./api";
import type { AuthUser } from "./auth";
import { addDays, dayStart, isYmd, toYmd, todayYmd } from "./dates";
import { Expense, Ledger, Order, Settings, User } from "./models";
import { round, withTxn } from "./orders";

/**
 * Net profit earned up to and including `upTo` (Dhaka day): sales after discount
 * − buying cost of non-cancelled sales − expenses. Same rules as the reports.
 */
export async function profitToDate(upTo: string) {
  const end = dayStart(addDays(upTo, 1));
  const [o] = await Order.aggregate([
    { $match: { saleDate: { $lt: end }, status: { $ne: "cancelled" } } },
    {
      $group: {
        _id: null,
        net: { $sum: { $subtract: ["$subtotal", "$discount"] } },
        cost: { $sum: { $sum: { $map: { input: "$items", as: "i", in: { $multiply: ["$$i.quantity", "$$i.unitCost"] } } } } },
      },
    },
  ]);
  const [e] = await Expense.aggregate([{ $match: { date: { $lt: end } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]);
  const gross = round((o?.net ?? 0) - (o?.cost ?? 0));
  const expenses = round(e?.total ?? 0);
  return { gross, expenses, net: round(gross - expenses) };
}

/** What can be distributed if the cut-off is `upTo`. */
export async function preview(upTo: string) {
  const s = await Settings.findById("main").lean();
  const p = await profitToDate(upTo);
  const already = round(s?.distributedTotal ?? 0);
  return { upTo, profit: p, alreadyDistributed: already, available: round(p.net - already), lastUpTo: s?.lastDistributedUpTo ? toYmd(s.lastDistributedUpTo) : null };
}

export async function distribute(b: Record<string, unknown>, me: AuthUser) {
  const upTo = b.upTo;
  if (!isYmd(upTo)) throw bad("Choose the date to distribute profit up to");
  if (upTo > todayYmd()) throw bad("The date can't be in the future");
  const raw = Array.isArray(b.shares) ? (b.shares as Record<string, unknown>[]) : [];
  const shares = raw
    .map((x) => ({ user: String(x.user ?? ""), pct: nonNeg(x.pct, "Percentage", { optional: true }) ?? 0 }))
    .filter((x) => x.pct > 0);
  if (!shares.length) throw bad("Give at least one partner a percentage");
  if (new Set(shares.map((x) => x.user)).size !== shares.length) throw bad("A partner is listed twice");
  const totalPct = round(shares.reduce((t, x) => t + x.pct, 0));
  if (totalPct > 100) throw bad(`Percentages add up to ${totalPct}%. They can't be more than 100%.`);
  if (!shares.every((x) => mongoose.isValidObjectId(x.user))) throw bad("Unknown partner");
  const users = await User.find({ _id: { $in: shares.map((x) => x.user) }, active: true }, { name: 1 }).lean();
  if (users.length !== shares.length) throw bad("One of the partners no longer exists or is switched off");
  const names = new Map(users.map((u) => [String(u._id), u.name]));
  const profit = await profitToDate(upTo);
  // Settings saved before distributions existed lack the counter the race guard matches on.
  await Settings.updateOne({ _id: "main", distributedTotal: { $exists: false } }, { $set: { distributedTotal: 0, lastDistributedUpTo: null } });

  return withTxn(async (session) => {
    const s = await Settings.findById("main").session(session);
    if (!s) throw bad("Settings missing");
    if (s.lastDistributedUpTo && upTo < toYmd(s.lastDistributedUpTo)) {
      throw bad(`Profit is already distributed up to ${toYmd(s.lastDistributedUpTo)}. Choose that date or later.`);
    }
    const already = round(s.distributedTotal);
    const available = round(profit.net - already);
    if (available <= 0) throw bad("There is no undistributed profit up to that date");
    // The person confirmed amounts based on what they saw; refuse if it moved since.
    if (b.expectedAvailable !== undefined && Math.abs(Number(b.expectedAvailable) - available) > 0.009) {
      throw new HttpError(409, `The amount available changed to ৳${available.toLocaleString("en-IN")} (someone else may have just distributed, or a sale changed). Please review and try again.`);
    }

    const rows = shares.map((x) => ({ user: new mongoose.Types.ObjectId(x.user), name: names.get(x.user)!, pct: x.pct, amount: round((available * x.pct) / 100) }));
    const distributed = round(rows.reduce((t, x) => t + x.amount, 0));

    // Matching the old total makes two simultaneous distributions impossible.
    const upd = await Settings.updateOne(
      { _id: "main", distributedTotal: s.distributedTotal },
      { $inc: { distributedTotal: distributed }, $set: { lastDistributedUpTo: dayStart(upTo) } },
      { session }
    );
    if (upd.modifiedCount !== 1) throw new HttpError(409, "Someone else just distributed profit. Refresh and try again.");
    for (const r of rows) {
      await User.updateOne({ _id: r.user }, { $inc: { balance: r.amount, totalReceived: r.amount } }, { session });
    }
    const [entry] = await Ledger.create(
      [{
        type: "distribution", by: me._id, byName: me.name, note: str(b.note, 300),
        upTo: dayStart(upTo), profitToDate: profit.net, alreadyDistributed: already, available,
        shares: rows, distributed, retained: round(available - distributed),
      }],
      { session }
    );
    return { _id: String(entry._id), distributed };
  });
}

export async function withdraw(b: Record<string, unknown>, me: AuthUser) {
  const uid = b.user ? String(b.user) : me._id;
  if (uid !== me._id && me.role !== "super") throw new HttpError(403, "You can only withdraw from your own account");
  if (!mongoose.isValidObjectId(uid)) throw bad("Unknown partner");
  const amount = nonNeg(b.amount, "Amount")!;
  if (amount <= 0) throw bad("Amount must be more than 0");

  return withTxn(async (session) => {
    const u = await User.findOneAndUpdate(
      { _id: uid, balance: { $gte: amount } },
      { $inc: { balance: -amount, totalWithdrawn: amount } },
      { session, returnDocument: "after" }
    );
    if (!u) {
      const cur = await User.findById(uid, { balance: 1 }).session(session).lean();
      if (!cur) throw bad("Unknown partner");
      throw bad(`Not enough balance. Available: ৳${cur.balance.toLocaleString("en-IN")}`);
    }
    const [entry] = await Ledger.create(
      [{ type: "withdrawal", by: me._id, byName: me.name, note: str(b.note, 300), user: u._id, userName: u.name, amount }],
      { session }
    );
    return { _id: String(entry._id), balance: u.balance };
  });
}

/** Super admin only: undo a withdrawal, or the latest distribution. Kept in the log as reversed. */
export async function reverse(id: string, me: AuthUser) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, "Entry not found");
  return withTxn(async (session) => {
    const e = await Ledger.findById(id).session(session);
    if (!e) throw new HttpError(404, "Entry not found");
    if (e.reversed) throw bad("This entry is already reversed");

    if (e.type === "withdrawal") {
      await User.updateOne({ _id: e.user }, { $inc: { balance: e.amount, totalWithdrawn: -e.amount } }, { session });
    } else {
      const latest = await Ledger.findOne({ type: "distribution", reversed: null }).sort({ createdAt: -1 }).session(session);
      if (!latest || String(latest._id) !== id) throw bad("Only the most recent distribution can be reversed");
      for (const sh of e.shares) {
        const ok = await User.updateOne({ _id: sh.user, balance: { $gte: sh.amount } }, { $inc: { balance: -sh.amount, totalReceived: -sh.amount } }, { session });
        if (ok.modifiedCount !== 1) throw bad(`${sh.name} has already withdrawn part of this money, so it can't be taken back`);
      }
      const prev = await Ledger.findOne({ type: "distribution", reversed: null, _id: { $ne: e._id } }).sort({ createdAt: -1 }).session(session);
      await Settings.updateOne({ _id: "main" }, { $inc: { distributedTotal: -e.distributed }, $set: { lastDistributedUpTo: prev?.upTo ?? null } }, { session });
    }
    e.reversed = { at: new Date(), by: new mongoose.Types.ObjectId(me._id), byName: me.name };
    await e.save({ session });
    return { ok: true };
  });
}
