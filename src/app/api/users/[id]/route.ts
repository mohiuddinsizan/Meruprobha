import { route, bad, HttpError } from "@/lib/api";
import { Ledger, User } from "@/lib/models";
import { parseUser } from "@/lib/users";

type Ctx = { params: Promise<{ id: string }> };

const load = async (id: string) => {
  const u = await User.findById(id).catch(() => null);
  if (!u) throw new HttpError(404, "Account not found");
  return u;
};

/** Edit details, reset password, or switch an account on/off. */
export const PATCH = route<Ctx>(async (req, { params }, me) => {
  const u = await load((await params).id);
  const b = await req.json();
  if (typeof b.active === "boolean" && Object.keys(b).length === 1) {
    if (u.role === "super") throw bad("The super admin account can't be switched off");
    u.active = b.active;
    if (!b.active) u.sessionVersion += 1; // signs them out everywhere
  } else {
    const next = await parseUser(b, String(u._id));
    if (next.passwordHash && String(u._id) !== me._id) u.sessionVersion += 1;
    u.set(next);
  }
  await u.save();
  return { ok: true };
}, { superOnly: true });

/** Only an account with no money history can be deleted; otherwise switch it off. */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const u = await load((await params).id);
  if (u.role === "super") throw bad("The super admin account can't be deleted");
  if (u.balance !== 0 || (await Ledger.exists({ $or: [{ user: u._id }, { "shares.user": u._id }, { by: u._id }] }))) {
    throw bad("This partner has money history, so they can't be deleted. Switch the account off instead.");
  }
  await u.deleteOne();
  return { ok: true };
}, { superOnly: true });
