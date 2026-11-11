// Edge-safe session helpers (used by middleware and API routes).
import { SignJWT, jwtVerify } from "jose";

export const COOKIE = "mp_session";
export const SESSION_DAYS = 30;

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export type Session = { uid: string; v: number };

export async function signSession(uid: string, version: number): Promise<string> {
  return new SignJWT({ v: version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(uid)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    // Tokens from the single-password era have subject "admin"; they no longer count.
    if (!payload.sub || !/^[a-f0-9]{24}$/.test(payload.sub)) return null;
    return { uid: payload.sub, v: Number(payload.v) };
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 24 * 3600,
};
