import { createHash, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { dbConnect } from "./db";
import { Settings, Category } from "./models";
import { COOKIE, verifySession } from "./session";
import { DEFAULT_GENRES } from "./constants";

/** Load the settings doc, creating it (and default genres) on first run. */
export async function getSettings() {
  await dbConnect();
  let s = await Settings.findById("main");
  if (!s) {
    const initial = process.env.INITIAL_ADMIN_PASSWORD || process.env.MASTER_PASSWORD;
    if (!initial) throw new Error("Set INITIAL_ADMIN_PASSWORD or MASTER_PASSWORD");
    s = await Settings.findOneAndUpdate(
      { _id: "main" },
      { $setOnInsert: { passwordHash: await bcrypt.hash(initial, 10) } },
      { upsert: true, returnDocument: "after" }
    );
    if ((await Category.countDocuments()) === 0) {
      await Category.insertMany(DEFAULT_GENRES.map((name) => ({ name, key: name.toLowerCase(), parent: null }))).catch(() => {});
    }
  }
  return s!;
}

export function isMasterPassword(pw: string): boolean {
  const master = process.env.MASTER_PASSWORD;
  if (!master) return false;
  const a = createHash("sha256").update(pw).digest();
  const b = createHash("sha256").update(master).digest();
  return timingSafeEqual(a, b);
}

export async function checkPassword(pw: string): Promise<boolean> {
  if (!pw) return false;
  if (isMasterPassword(pw)) return true;
  const s = await getSettings();
  return bcrypt.compare(pw, s.passwordHash);
}

/** True if the request carries a valid, current session. */
export async function isAuthed(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  const sess = await verifySession(token);
  if (!sess) return false;
  const s = await getSettings();
  return sess.v === s.sessionVersion;
}
