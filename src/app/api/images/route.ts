import mongoose from "mongoose";
import { Readable } from "stream";
import { route, bad } from "@/lib/api";

const MAX = 6 * 1024 * 1024;

export const POST = route(async (req) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw bad("No image uploaded");
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) throw bad("Only image files are allowed");
  if (file.size > MAX) throw bad("Image is too large (max 6 MB)");

  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "images" });
  const buf = Buffer.from(await file.arrayBuffer());
  const upload = bucket.openUploadStream(file.name || "image", { metadata: { contentType: file.type } });
  await new Promise<void>((resolve, reject) => {
    Readable.from(buf).pipe(upload).on("finish", () => resolve()).on("error", reject);
  });
  return { _id: String(upload.id) };
});
