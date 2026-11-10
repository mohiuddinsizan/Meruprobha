import { Types } from "mongoose";
import { route, bad, str } from "@/lib/api";
import { getSettings } from "@/lib/auth";
import { Category, Product } from "@/lib/models";

export const GET = route(async () => {
  await getSettings(); // ensures default genres exist on first run
  const [cats, genreCounts, catCounts] = await Promise.all([
    Category.find().sort({ name: 1 }).lean(),
    Product.aggregate([{ $match: { archived: false } }, { $group: { _id: "$genre", n: { $sum: 1 } } }]),
    Product.aggregate([{ $match: { archived: false, category: { $ne: null } } }, { $group: { _id: "$category", n: { $sum: 1 } } }]),
  ]);
  const count = new Map<string, number>([...genreCounts, ...catCounts].map((c) => [String(c._id), c.n]));
  const genres = cats.filter((c) => !c.parent);
  return genres.map((g) => ({
    _id: String(g._id),
    name: g.name,
    productCount: count.get(String(g._id)) ?? 0,
    categories: cats
      .filter((c) => String(c.parent) === String(g._id))
      .map((c) => ({ _id: String(c._id), name: c.name, productCount: count.get(String(c._id)) ?? 0 })),
  }));
});

export const POST = route(async (req) => {
  const b = await req.json();
  const name = str(b.name, 60);
  if (!name) throw bad("Name is required");
  let parent: Types.ObjectId | null = null;
  if (b.parent) {
    const g = await Category.findOne({ _id: b.parent, parent: null });
    if (!g) throw bad("Genre not found");
    parent = g._id;
  }
  const c = await Category.create({ name, key: name.toLowerCase(), parent });
  return { _id: String(c._id), name: c.name };
});
