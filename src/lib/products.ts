import mongoose, { Types } from "mongoose";
import { bad, nonNeg, str } from "./api";
import { Category } from "./models";

export type ProductInput = {
  name: string;
  genre: Types.ObjectId;
  category: Types.ObjectId | null;
  buyingPrice: number;
  sellingPrice: number | null;
  quantity: number;
  description: string;
  images: Types.ObjectId[];
};

/** Validates a product form body and resolves genre/category. Returns names for history. */
export async function parseProduct(b: Record<string, unknown>) {
  const name = str(b.name, 150);
  if (!name) throw bad("Product name is required");
  if (!mongoose.isValidObjectId(b.genre)) throw bad("Select a genre");
  const genre = await Category.findOne({ _id: String(b.genre), parent: null });
  if (!genre) throw bad("Select a genre");

  let category = null;
  if (b.category) {
    category = await Category.findOne({ _id: String(b.category), parent: genre._id });
    if (!category) throw bad("Category does not belong to this genre");
  } else if (await Category.exists({ parent: genre._id })) {
    throw bad("Select a category");
  }

  const images = Array.isArray(b.images) ? b.images.filter((i) => mongoose.isValidObjectId(i)).slice(0, 10) : [];
  const input: ProductInput = {
    name,
    genre: genre._id,
    category: category?._id ?? null,
    buyingPrice: nonNeg(b.buyingPrice, "Buying price")!,
    sellingPrice: nonNeg(b.sellingPrice, "Selling price", { optional: true }),
    quantity: nonNeg(b.quantity, "Quantity", { int: true })!,
    description: str(b.description, 5000),
    images: images.map((i) => new Types.ObjectId(String(i))),
  };
  return { input, genreName: genre.name, categoryName: category?.name ?? null };
}

export async function deleteImages(ids: (Types.ObjectId | string)[]) {
  if (!ids.length) return;
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "images" });
  await Promise.all(ids.map((id) => bucket.delete(new Types.ObjectId(String(id))).catch(() => {})));
}
