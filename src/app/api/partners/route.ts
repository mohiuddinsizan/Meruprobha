import { route } from "@/lib/api";
import { Partner } from "@/lib/models";
import { parsePartner } from "@/lib/partners";

export const GET = route(async () => {
  const partners = await Partner.find().sort({ sharePct: -1, createdAt: 1 }).lean();
  return partners.map((p) => ({ ...p, _id: String(p._id) }));
});

export const POST = route(async (req) => {
  const p = await Partner.create(await parsePartner(await req.json()));
  return { _id: String(p._id) };
});
