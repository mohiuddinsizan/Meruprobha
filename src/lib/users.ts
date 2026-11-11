import bcrypt from "bcryptjs";
import { bad, HttpError, str } from "./api";
import { User, type UserDoc } from "./models";

export const publicUser = (u: Pick<UserDoc, "_id" | "username" | "name" | "phone" | "role" | "active" | "balance" | "totalReceived" | "totalWithdrawn" | "createdAt">) => ({
  _id: String(u._id), username: u.username, name: u.name, phone: u.phone, role: u.role, active: u.active,
  balance: u.balance, totalReceived: u.totalReceived, totalWithdrawn: u.totalWithdrawn, createdAt: u.createdAt,
});

/** Validates account fields. A password is required on create, optional (reset) on edit. */
export async function parseUser(b: Record<string, unknown>, id: string | null) {
  const creating = !id;
  const name = str(b.name, 80);
  if (!name) throw bad("Enter the partner's name");
  const username = str(b.username, 30).toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw bad("Username must be 3–30 letters, numbers, dots, dashes or underscores (no spaces)");
  // Builds the unique index on a fresh database; the explicit check gives a clear message.
  await User.init();
  if (await User.exists({ username, ...(id ? { _id: { $ne: id } } : {}) })) throw new HttpError(409, `The username "${username}" is already taken`);
  const out: Record<string, unknown> = { name, username, phone: str(b.phone, 20) };
  const pw = str(b.password, 200);
  if (creating || pw) {
    if (pw.length < 6) throw bad("Password must be at least 6 characters");
    out.passwordHash = await bcrypt.hash(pw, 10);
  }
  return out;
}
