import { route, HttpError } from "@/lib/api";
import { Category, Order, Product } from "@/lib/models";
import { deleteImages, parseProduct } from "@/lib/products";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  const p = await Product.findById(id).catch(() => null);
  if (!p) throw new HttpError(404, "Product not found");
  return p;
}

export const GET = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const p = await Product.findById(id).populate("genre", "name").populate("category", "name").lean().catch(() => null);
  if (!p) throw new HttpError(404, "Product not found");
  const sold = await Order.aggregate([
    { $match: { status: { $ne: "cancelled" }, "items.product": p._id } },
    { $unwind: "$items" },
    { $match: { "items.product": p._id } },
    { $group: { _id: null, qty: { $sum: "$items.quantity" }, revenue: { $sum: { $multiply: ["$items.quantity", "$items.unitPrice"] } } } },
  ]);
  p.history = [...(p.history ?? [])].reverse();
  return { ...p, sold: sold[0] ?? { qty: 0, revenue: 0 } };
});

const LABEL: Record<string, string> = {
  name: "Name",
  genre: "Genre",
  category: "Category",
  buyingPrice: "Buying price",
  sellingPrice: "Selling price",
  quantity: "Quantity",
  description: "Description",
  images: "Images",
};

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const p = await load(id);
  const body = await req.json();

  if (typeof body.archived === "boolean" && Object.keys(body).length === 1) {
    p.archived = body.archived;
    p.history.push({ type: "edit", note: body.archived ? "Archived" : "Restored from archive", changes: [] });
    await p.save();
    return { ok: true };
  }

  const { input, genreName, categoryName } = await parseProduct(body);
  const nameOf = async (cid: unknown) => (cid ? (await Category.findById(cid))?.name ?? "—" : "—");
  const changes: { field: string; from: unknown; to: unknown }[] = [];

  for (const f of ["name", "buyingPrice", "sellingPrice", "quantity", "description"] as const) {
    const before = p[f] ?? null;
    const after = input[f] ?? null;
    if (before !== after) changes.push({ field: LABEL[f], from: before, to: after });
  }
  if (String(p.genre) !== String(input.genre)) changes.push({ field: LABEL.genre, from: await nameOf(p.genre), to: genreName });
  if (String(p.category ?? "") !== String(input.category ?? ""))
    changes.push({ field: LABEL.category, from: await nameOf(p.category), to: categoryName ?? "—" });

  const oldImgs = p.images.map(String);
  const newImgs = input.images.map(String);
  const removed = oldImgs.filter((i) => !newImgs.includes(i));
  const added = newImgs.filter((i) => !oldImgs.includes(i));
  if (removed.length || added.length || oldImgs.join() !== newImgs.join()) {
    const parts = [added.length && `${added.length} added`, removed.length && `${removed.length} removed`].filter(Boolean);
    changes.push({ field: LABEL.images, from: `${oldImgs.length} image(s)`, to: `${newImgs.length} image(s)${parts.length ? ` (${parts.join(", ")})` : " (reordered)"}` });
  }

  if (!changes.length) return { ok: true, changed: false };

  Object.assign(p, input);
  p.lastEditedAt = new Date();
  p.history.push({ type: "edit", changes, qtyChange: changes.some((c) => c.field === "Quantity") ? input.quantity - Number(changes.find((c) => c.field === "Quantity")!.from) : undefined });
  await p.save();
  await deleteImages(removed);
  return { ok: true, changed: true };
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const p = await load(id);
  if (await Order.exists({ "items.product": p._id })) {
    // Keep it for sales history; just hide it.
    p.archived = true;
    p.history.push({ type: "edit", note: "Archived (it has sales, so it can't be fully deleted)", changes: [] });
    await p.save();
    return { ok: true, archived: true };
  }
  await p.deleteOne();
  await deleteImages(p.images);
  return { ok: true, archived: false };
});
