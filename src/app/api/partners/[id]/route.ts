import { route, HttpError } from "@/lib/api";
import { Partner } from "@/lib/models";
import { parsePartner } from "@/lib/partners";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const prev = await Partner.findById(id).catch(() => null);
  if (!prev) throw new HttpError(404, "Partner not found");
  const next = await parsePartner(await req.json(), id);
  if (next.sharePct !== prev.sharePct) prev.shareHistory.push({ at: new Date(), from: prev.sharePct, to: next.sharePct });
  prev.set(next);
  await prev.save();
  return { ok: true };
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const p = await Partner.findByIdAndDelete(id).catch(() => null);
  if (!p) throw new HttpError(404, "Partner not found");
  return { ok: true };
});
