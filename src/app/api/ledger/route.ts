import mongoose from "mongoose";
import { route } from "@/lib/api";
import { Ledger } from "@/lib/models";

/** Everyone can read the full money log. */
export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  const filter: Record<string, unknown> = {};
  const type = sp.get("type");
  if (type === "distribution" || type === "withdrawal") filter.type = type;
  const user = sp.get("user");
  if (user && mongoose.isValidObjectId(user)) {
    const id = new mongoose.Types.ObjectId(user);
    filter.$or = [{ user: id }, { "shares.user": id }];
  }
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = 30;
  const [entries, total] = await Promise.all([
    Ledger.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Ledger.countDocuments(filter),
  ]);
  const latest = await Ledger.findOne({ type: "distribution", reversed: null }, { _id: 1 }).sort({ createdAt: -1 }).lean();
  return { entries, total, page, limit, latestDistribution: latest ? String(latest._id) : null };
});
