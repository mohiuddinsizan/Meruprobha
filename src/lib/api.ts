import { NextResponse } from "next/server";
import { currentUser, type AuthUser } from "./auth";
import { dbConnect } from "./db";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const bad = (msg: string) => new HttpError(400, msg);

type Handler<C> = (req: Request, ctx: C, user: AuthUser) => Promise<unknown>;

/**
 * Wraps a route handler: requires login (or the super admin with `superOnly`),
 * connects DB, passes the signed-in account, turns errors into JSON.
 */
export function route<C = unknown>(fn: Handler<C>, opts: { public?: boolean; superOnly?: boolean } = {}) {
  return async (req: Request, ctx: C) => {
    try {
      await dbConnect();
      const user = opts.public ? null : await currentUser();
      if (!opts.public && !user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
      if (opts.superOnly && user?.role !== "super") return NextResponse.json({ error: "Only the super admin can do this" }, { status: 403 });
      const out = await fn(req, ctx, user as AuthUser);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e: unknown) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      const err = e as { name?: string; code?: number; message?: string };
      if (err?.name === "ValidationError" || err?.name === "CastError") {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      if (err?.code === 11000) return NextResponse.json({ error: "That name already exists" }, { status: 409 });
      console.error(e);
      return NextResponse.json({ error: "Something went wrong on the server" }, { status: 500 });
    }
  };
}

export const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export function nonNeg(v: unknown, field: string, { optional = false, int = false } = {}): number | null {
  if (optional && (v === null || v === undefined || v === "")) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) throw bad(`${field} must be a number ≥ 0`);
  if (int && !Number.isInteger(n)) throw bad(`${field} must be a whole number`);
  return Math.round(n * 100) / 100;
}
