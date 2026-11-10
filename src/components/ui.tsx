"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Gem, Loader2, X, type LucideIcon } from "lucide-react";
import { STATUS_LABEL, type OrderStatus } from "@/lib/constants";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------- Buttons ---------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
  href?: string;
};
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500";
const btnVariant = {
  primary: "bg-ink text-gold-50 shadow-sm shadow-black/10 hover:bg-espresso hover:shadow-md ring-1 ring-inset ring-gold-500/30",
  secondary: "bg-white text-ink border border-line hover:border-gold-300 hover:bg-gold-50/60",
  danger: "bg-red-700 text-white hover:bg-red-800",
  ghost: "text-muted hover:bg-gold-50 hover:text-ink",
};
const btnSize = { sm: "h-8 px-3.5 text-xs", md: "h-10 px-5 text-sm" };

export function Button({ variant = "primary", size = "md", loading, href, className, children, ...rest }: BtnProps) {
  // A caller's "hidden" must beat the base inline-flex, so swap it in rather than stacking both.
  const base = /(^|\s)hidden(\s|$)/.test(className ?? "") ? btnBase.replace("inline-flex", "") : btnBase;
  const cls = cx(base, btnVariant[variant], btnSize[size], className);
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return (
    <button className={cls} disabled={loading || rest.disabled} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ---------- Form fields ---------- */
const fieldCls =
  "w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink placeholder:text-stone-400 transition-colors hover:border-gold-200 focus:border-gold-400 focus:outline-none focus:ring-4 focus:ring-gold-100 disabled:bg-ivory disabled:text-stone-400";

export function Field({ label, hint, required, children, className }: { label: string; hint?: ReactNode; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-stone-700">
        {label} {required && <span className="text-gold-600">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldCls, "h-10", className)} {...p} />;
}
export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldCls, "py-2", className)} rows={3} {...p} />;
}
export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(fieldCls, "h-10 pr-8", className)} {...p}>
      {children}
    </select>
  );
}

/* ---------- Layout bits ---------- */
export function Card({ className, children, title, action }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx("rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(26,22,19,0.04),0_8px_24px_-12px_rgba(26,22,19,0.08)]", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
          <h2 className="font-display text-xl font-semibold leading-none text-ink">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, back, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: string; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        {back ? (
          <Link href={back} className="mb-2 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.18em] text-gold-600 hover:text-gold-700">
            ← Back
          </Link>
        ) : (
          eyebrow && <p className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-gold-600">{eyebrow}</p>
        )}
        <h1 className="font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">{title}</h1>
        {subtitle && <div className="mt-1.5 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ children, tone = "stone", className }: { children: ReactNode; tone?: "stone" | "amber" | "blue" | "green" | "red" | "gold"; className?: string }) {
  const tones = {
    stone: "bg-stone-50 text-stone-700 ring-stone-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    blue: "bg-blue-50 text-blue-800 ring-blue-200",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    gold: "bg-gold-50 text-gold-700 ring-gold-200",
  };
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", tones[tone], className)}>{children}</span>;
}

const STATUS_TONE: Record<OrderStatus, "amber" | "blue" | "green" | "red"> = {
  packaging: "amber",
  out_for_delivery: "blue",
  delivered: "green",
  cancelled: "red",
};
export function StatusBadge({ status }: { status: string }) {
  const s = status as OrderStatus;
  const dot = { amber: "bg-amber-500", blue: "bg-blue-600", green: "bg-emerald-600", red: "bg-red-600", stone: "bg-stone-400" }[STATUS_TONE[s] ?? "stone"];
  return (
    <Badge tone={STATUS_TONE[s] ?? "stone"}>
      <span className={cx("size-1.5 rounded-full", dot)} />
      {STATUS_LABEL[s] ?? status}
    </Badge>
  );
}

export function PaymentBadge({ due, total }: { due: number; total: number }) {
  if (due <= 0) return <Badge tone="green">Paid</Badge>;
  if (due < total) return <Badge tone="amber">Partial</Badge>;
  return <Badge tone="red">Unpaid</Badge>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cx("flex justify-center py-16 text-gold-400", className)}>
      <Loader2 className="size-6 animate-spin" />
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-gold-50 text-gold-400 ring-1 ring-gold-100">
        <Gem className="size-5" />
      </span>
      <p className="font-display text-xl font-semibold text-ink">{title}</p>
      {children && <div className="mt-1.5 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{error instanceof Error ? error.message : String(error)}</span>
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-espresso/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        className={cx("max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:rounded-2xl sm:pb-0", wide ? "sm:max-w-2xl" : "sm:max-w-md")}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-white px-5 py-4">
          <h3 className="font-display text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-stone-500 hover:bg-stone-100" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Confirm dialog driven by a promise: `if (await confirm({...})) ...` */
type ConfirmOpts = { title: string; message: ReactNode; confirmText?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

/* ---------- Toasts ---------- */
type Toast = { id: number; msg: string; tone: "ok" | "err" };
const ToastCtx = createContext<(msg: string, tone?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function Providers({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((msg: string, tone: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const [pending, setPending] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setPending({ ...o, resolve })), []);
  const close = (v: boolean) => {
    pending?.resolve(v);
    setPending(null);
  };

  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        <Modal open={!!pending} onClose={() => close(false)} title={pending?.title ?? ""}>
          <div className="text-sm text-stone-600">{pending?.message}</div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => close(false)}>Cancel</Button>
            <Button variant={pending?.danger ? "danger" : "primary"} onClick={() => close(true)}>
              {pending?.confirmText ?? "Confirm"}
            </Button>
          </div>
        </Modal>
        <div className="pointer-events-none fixed inset-x-4 bottom-24 z-[80] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cx(
                "pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-lg",
                t.tone === "ok" ? "bg-ink ring-1 ring-gold-500/40" : "bg-red-700"
              )}
            >
              {t.tone === "ok" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-gold-300" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
              {t.msg}
            </div>
          ))}
        </div>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

/* ---------- Stat tile ---------- */
export function Stat({ label, value, sub, emphasis, icon: Icon }: { label: string; value: ReactNode; sub?: ReactNode; emphasis?: boolean; icon?: LucideIcon }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-2xl border p-4 sm:p-5",
        emphasis ? "border-gold-500/30 bg-ink text-gold-50 shadow-lg shadow-black/10" : "border-line bg-white shadow-[0_1px_2px_rgba(26,22,19,0.04)]"
      )}
    >
      {emphasis && <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full border border-gold-500/20" />}
      {emphasis && <div className="pointer-events-none absolute -right-4 -top-4 size-20 rounded-full border border-gold-500/20" />}
      <div className="flex items-start justify-between gap-2">
        <p className={cx("text-[10px] font-medium uppercase leading-snug tracking-[0.1em] sm:text-[11px] sm:tracking-[0.16em]", emphasis ? "text-gold-300" : "text-muted")}>{label}</p>
        {Icon && (
          <span className={cx("hidden size-8 shrink-0 place-items-center rounded-full sm:grid", emphasis ? "bg-gold-500/15 text-gold-300" : "bg-gold-50 text-gold-600")}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className={cx("mt-2 truncate text-xl font-semibold tabular-nums sm:text-2xl", emphasis ? "text-white" : "text-ink")}>{value}</p>
      {sub && <p className={cx("mt-1 text-xs", emphasis ? "text-stone-400" : "text-muted")}>{sub}</p>}
    </div>
  );
}

/** Segmented toggle (e.g. grid/list). */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[] }) {
  return (
    <div className="inline-flex rounded-full border border-line bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx("flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors", value === o.value ? "bg-ink text-gold-50" : "text-muted hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Pill tabs with counts, horizontally scrollable on phones. */
export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={cx(
              "flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
              value === t.value ? "border-ink bg-ink text-gold-50" : "border-line bg-white text-stone-600 hover:border-gold-300"
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cx("rounded-full px-1.5 text-[11px] tabular-nums", value === t.value ? "bg-gold-500/25 text-gold-100" : "bg-ivory text-muted")}>{t.count}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
