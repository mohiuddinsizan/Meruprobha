import mongoose from "mongoose";
import { route } from "@/lib/api";
import { getSettings } from "@/lib/auth";
import { Product, nextSeq } from "@/lib/models";
import { parseProduct } from "@/lib/products";

export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  const filter: Record<string, unknown> = { archived: sp.get("archived") === "1" };
  const q = sp.get("q")?.trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { code: rx }];
  }
  if (mongoose.isValidObjectId(sp.get("genre"))) filter.genre = sp.get("genre");
  if (mongoose.isValidObjectId(sp.get("category"))) filter.category = sp.get("category");
  const stock = sp.get("stock");
  const { lowStockThreshold } = await getSettings();
  if (stock === "out") filter.quantity = 0;
  else if (stock === "low") filter.quantity = { $gt: 0, $lte: lowStockThreshold };
  else if (stock === "in") filter.quantity = { $gt: 0 };

  const list = await Product.find(filter)
    .select("-history")
    .populate("genre", "name")
    .populate("category", "name")
    .sort({ updatedAt: -1 })
    .limit(1000)
    .lean();
  return { lowStockThreshold, products: list };
});

export const POST = route(async (req) => {
  const { input } = await parseProduct(await req.json());
  const code = "P-" + String(await nextSeq("product")).padStart(4, "0");
  const p = await Product.create({
    ...input,
    code,
    history: [{ type: "created", note: `Added with quantity ${input.quantity}` }],
  });
  return { _id: String(p._id) };
});
