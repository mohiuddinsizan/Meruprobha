import { NextResponse } from "next/server";
import { route, HttpError, str } from "@/lib/api";
import { findLoginUser } from "@/lib/auth";
import { COOKIE, cookieOptions, signSession } from "@/lib/session";

// Simple in-memory brute-force guard: 5 failures locks that IP for 5 minutes.
const fails = new Map<string, { n: number; until: number }>();

export const POST = route(async (req) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const f = fails.get(ip);
  if (f && f.until > Date.now()) throw new HttpError(429, "Too many wrong attempts. Try again in a few minutes.");

  const body = await req.json().catch(() => ({}));
  const u = await findLoginUser(str(body.username, 40), str(body.password, 200));
  if (!u) {
    const n = (f && f.until > Date.now() - 5 * 60_000 ? f.n : 0) + 1;
    fails.set(ip, { n, until: n >= 5 ? Date.now() + 5 * 60_000 : 0 });
    throw new HttpError(401, "Wrong username or password");
  }
  fails.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await signSession(String(u._id), u.sessionVersion), cookieOptions);
  return res;
}, { public: true });
