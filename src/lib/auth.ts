import { createHash, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { dbConnect } from "./db";
import { Settings, Category, User, type UserDoc } from "./models";
import { COOKIE, verifySession } from "./session";
import { DEFAULT_GENRES } from "./constants";

/** Load the settings doc, creating it (and default genres) on first run. */
export async function getSettings() {
  await dbConnect();
  let s = await Settings.findById("main");
  if (!s) {
    s = await Settings.findOneAndUpdate({ _id: "main" }, { $setOnInsert: { passwordHash: "" } }, { upsert: true, returnDocument: "after" });
    if ((await Category.countDocuments()) === 0) {
      await Category.insertMany(DEFAULT_GENRES.map((name) => ({ name, key: name.toLowerCase(), parent: null }))).catch(() => {});
    }
  }
  return s!;
}

/**
 * Makes sure the super admin exists. The first one takes over the old single
 * admin password, so the owner keeps logging in with what they already use.
 */
export async function ensureSuperAdmin() {
  if (await User.exists({ role: "super" })) return;
  const s = await getSettings();
  let hash = s.passwordHash;
  if (!hash) {
    const initial = process.env.INITIAL_ADMIN_PASSWORD || process.env.MASTER_PASSWORD;
    if (!initial) throw new Error("Set INITIAL_ADMIN_PASSWORD or MASTER_PASSWORD");
    hash = await bcrypt.hash(initial, 10);
  }
  await User.create({ username: "admin", name: "Admin", role: "super", passwordHash: hash, sessionVersion: s.sessionVersion }).catch((e) => {
    if (e?.code !== 11000) throw e;
  });
}

export function isMasterPassword(pw: string): boolean {
  const master = process.env.MASTER_PASSWORD;
  if (!master) return false;
  const a = createHash("sha256").update(pw).digest();
  const b = createHash("sha256").update(master).digest();
  return timingSafeEqual(a, b);
}

/** The active account for these credentials. The master password opens any account. */
export async function findLoginUser(username: string, pw: string) {
  await ensureSuperAdmin();
  if (!username || !pw) return null;
  const u = await User.findOne({ username: username.toLowerCase(), active: true });
  if (!u) return null;
  if (isMasterPassword(pw) || (await bcrypt.compare(pw, u.passwordHash))) return u;
  return null;
}

export async function passwordMatches(u: Pick<UserDoc, "passwordHash">, pw: string) {
  return !!pw && (isMasterPassword(pw) || bcrypt.compare(pw, u.passwordHash));
}

export type AuthUser = { _id: string; name: string; username: string; role: "super" | "admin" };

/** The signed-in account, or null if the session is missing, stale or the account is off. */
export async function currentUser(): Promise<AuthUser | null> {
  const sess = await verifySession((await cookies()).get(COOKIE)?.value);
  if (!sess) return null;
  await dbConnect();
  const u = await User.findById(sess.uid, { name: 1, username: 1, role: 1, active: 1, sessionVersion: 1 }).lean();
  if (!u || !u.active || u.sessionVersion !== sess.v) return null;
  return { _id: String(u._id), name: u.name, username: u.username, role: u.role };
}
