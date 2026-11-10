import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { route, bad, HttpError, str } from "@/lib/api";
import { checkPassword } from "@/lib/auth";
import { Settings } from "@/lib/models";
import { COOKIE, cookieOptions, signSession } from "@/lib/session";

export const POST = route(async (req) => {
  const body = await req.json();
  const current = str(body.currentPassword, 200);
  const next = str(body.newPassword, 200);
  if (!(await checkPassword(current))) throw new HttpError(403, "Current password is wrong");
  if (next.length < 6) throw bad("New password must be at least 6 characters");

  // Bumping the version signs out every other device.
  const s = await Settings.findByIdAndUpdate(
    "main",
    { passwordHash: await bcrypt.hash(next, 10), $inc: { sessionVersion: 1 } },
    { returnDocument: "after" }
  );
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await signSession(s!.sessionVersion), cookieOptions);
  return res;
});
