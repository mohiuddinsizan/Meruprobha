import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { route, bad, HttpError, str } from "@/lib/api";
import { passwordMatches } from "@/lib/auth";
import { User } from "@/lib/models";
import { COOKIE, cookieOptions, signSession } from "@/lib/session";

export const POST = route(async (req, _ctx, me) => {
  const body = await req.json();
  const current = str(body.currentPassword, 200);
  const next = str(body.newPassword, 200);
  const u = await User.findById(me._id);
  if (!u || !(await passwordMatches(u, current))) throw new HttpError(403, "Current password is wrong");
  if (next.length < 6) throw bad("New password must be at least 6 characters");

  // Bumping the version signs this account out on every other device.
  u.passwordHash = await bcrypt.hash(next, 10);
  u.sessionVersion += 1;
  await u.save();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await signSession(me._id, u.sessionVersion), cookieOptions);
  return res;
});
