import mongoose from "mongoose";
import { route, HttpError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, "Not found");
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "images" });
  const _id = new mongoose.Types.ObjectId(id);
  const file = (await bucket.find({ _id }).toArray())[0];
  if (!file) throw new HttpError(404, "Not found");
  const chunks: Buffer[] = [];
  for await (const c of bucket.openDownloadStream(_id)) chunks.push(c as Buffer);
  return new Response(new Uint8Array(Buffer.concat(chunks)), {
    headers: {
      "Content-Type": (file.metadata?.contentType as string) || "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});
