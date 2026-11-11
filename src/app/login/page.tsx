"use client";

import { useState } from "react";
import { Eye, EyeOff, Gem, Lock, User } from "lucide-react";
import { Button, ErrorBox, Input } from "@/components/ui";
import { api } from "@/lib/client";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/login", "POST", { username, password });
      window.location.href = "/";
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-espresso lg:block">
        <Rings />
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-3">
            <span className="gold-fill grid size-11 place-items-center rounded-full text-espresso ring-1 ring-gold-200/40">
              <Gem className="size-5" strokeWidth={1.75} />
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.35em] text-stone-400">Fine Jewellery</span>
          </div>
          <div>
            <h1 className="gold-text pb-2 font-display text-6xl font-semibold leading-none tracking-wide xl:text-7xl 2xl:text-8xl">Meroprobha</h1>
            <div className="hairline-gold my-8 h-px w-40" />
            <p className="max-w-md font-display text-2xl leading-snug text-stone-300">
              Every piece, every sale, every taka — <span className="italic text-gold-300">beautifully accounted for.</span>
            </p>
          </div>
          <p className="text-xs text-stone-600">© {new Date().getFullYear()} Meroprobha · Admin console</p>
        </div>
      </div>

      {/* Form */}
      <div className="relative flex flex-col items-center justify-center bg-ivory px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex flex-col items-center text-center lg:hidden">
            <span className="gold-fill mb-4 grid size-14 place-items-center rounded-full text-espresso shadow-lg shadow-gold-700/20">
              <Gem className="size-6" strokeWidth={1.75} />
            </span>
            <h1 className="font-display text-5xl font-semibold tracking-wide text-ink">Meroprobha</h1>
            <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.35em] text-gold-600">Fine Jewellery</p>
          </div>

          <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold-600">Welcome back</p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-ink">Sign in</h2>
          <p className="mt-2 text-sm text-muted">Enter your username and password to open the boutique console.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="relative">
              <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gold-500" />
              <Input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 pl-11"
                autoFocus
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gold-500" />
              <Input
                type={show ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 pl-11 pr-11"
                required
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-stone-400 hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <ErrorBox error={error} />
            <Button type="submit" loading={loading} className="h-12 w-full text-sm">
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Decorative concentric gold rings. */
function Rings() {
  return (
    <svg className="absolute -right-40 top-1/2 h-[900px] w-[900px] -translate-y-1/2 opacity-60" viewBox="0 0 900 900" fill="none" aria-hidden>
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e7d3a8" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#b08640" stopOpacity="0.15" />
          <stop offset="1" stopColor="#e7d3a8" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      {[430, 360, 290, 220, 150].map((r, i) => (
        <circle key={r} cx="450" cy="450" r={r} stroke="url(#g)" strokeWidth={i === 2 ? 1.5 : 0.75} />
      ))}
      <circle cx="450" cy="160" r="5" fill="#d8b97a" fillOpacity="0.8" />
      <circle cx="740" cy="450" r="3" fill="#d8b97a" fillOpacity="0.6" />
    </svg>
  );
}
