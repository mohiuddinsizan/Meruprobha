import { route, bad, str, HttpError } from "@/lib/api";
import { Category, Product } from "@/lib/models";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const name = str((await req.json()).name, 60);
  if (!name) throw bad("Name is required");
  const c = await Category.findByIdAndUpdate(id, { name, key: name.toLowerCase() }, { returnDocument: "after", runValidators: true });
  if (!c) throw new HttpError(404, "Not found");
  return { _id: String(c._id), name: c.name };
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const c = await Category.findById(id);
  if (!c) throw new HttpError(404, "Not found");
  if (!c.parent && (await Category.countDocuments({ parent: c._id }))) {
    throw bad("Delete or move this genre's categories first");
  }
  const used = await Product.countDocuments({ $or: [{ genre: c._id }, { category: c._id }] });
  if (used) throw bad(`${used} product(s) use this. Change them first.`);
  await c.deleteOne();
  return { ok: true };
});
