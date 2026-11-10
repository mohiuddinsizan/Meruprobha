import { bad, nonNeg, str } from "./api";
import { Partner } from "./models";

/** Validates a partner and checks all shares together stay within 100%. */
export async function parsePartner(b: Record<string, unknown>, id?: string) {
  const name = str(b.name, 80);
  if (!name) throw bad("Enter the partner's name");
  const sharePct = nonNeg(b.sharePct, "Share %")!;
  if (sharePct > 100) throw bad("Share can't be more than 100%");
  const others = await Partner.find(id ? { _id: { $ne: id } } : {}, { sharePct: 1 }).lean();
  const used = others.reduce((s, p) => s + p.sharePct, 0);
  if (used + sharePct > 100.001) throw bad(`Shares would add up to ${+(used + sharePct).toFixed(2)}%. Only ${+(100 - used).toFixed(2)}% is left to give.`);
  return { name, sharePct, phone: str(b.phone, 20), note: str(b.note, 500) };
}
