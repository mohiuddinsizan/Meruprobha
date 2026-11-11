"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Boxes, Gem, LayoutDashboard, LogOut, Menu, Plus, ShoppingBag, Tags, UserCog, Users, Wallet, X } from "lucide-react";
import { cx } from "./ui";
import { api, useApi } from "@/lib/client";

const GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Boutique",
    items: [
      { href: "/sales", label: "Sales", icon: ShoppingBag },
      { href: "/expenses", label: "Expenses", icon: Wallet },
      { href: "/partners", label: "Partners", icon: Users },
      { href: "/inventory", label: "Inventory", icon: Boxes },
      { href: "/categories", label: "Genres & Categories", icon: Tags },
    ],
  },
  { label: "Account", items: [{ href: "/profile", label: "Profile & Settings", icon: UserCog }] },
];

const TABS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/sales", label: "Sales", icon: ShoppingBag },
  { href: "/inventory", label: "Stock", icon: Boxes },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { data: settings } = useApi<{ shopName: string }>("/api/settings");
  const shop = settings?.shopName ?? "Meroprobha";

  // Forms keep their own pinned Save bar on phones, so the tab bar steps aside.
  const formPage = /\/(new|edit)$/.test(path);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const logout = async () => {
    await api("/api/auth/logout", "POST");
    window.location.href = "/login";
  };

  const brand = (
    <Link href="/" className="flex items-center gap-3">
      <span className="gold-fill grid size-10 place-items-center rounded-full text-espresso shadow-lg shadow-black/30 ring-1 ring-gold-200/40">
        <Gem className="size-[18px]" strokeWidth={1.75} />
      </span>
      <span className="leading-none">
        <span className="gold-text block font-display text-2xl font-semibold tracking-wide">{shop}</span>
        <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.3em] text-stone-500">Fine Jewellery</span>
      </span>
    </Link>
  );

  const nav = (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-2">
      {GROUPS.map((g) => (
        <div key={g.label}>
          <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.25em] text-stone-600">{g.label}</p>
          <ul className="space-y-0.5">
            {g.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(path, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cx(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      active ? "bg-gradient-to-r from-gold-500/15 to-transparent text-gold-100" : "text-stone-400 hover:bg-white/[0.04] hover:text-stone-100"
                    )}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-gold-400" />}
                    <Icon className={cx("size-[18px]", active ? "text-gold-300" : "text-stone-500 group-hover:text-stone-300")} strokeWidth={1.75} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/[0.06] p-3">
      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
        <span className="grid size-8 place-items-center rounded-full bg-white/[0.06] font-display text-sm font-semibold text-gold-300">A</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-stone-200">Admin</span>
          <span className="block text-[11px] text-stone-500">Owner account</span>
        </span>
        <button onClick={logout} className="rounded-lg p-2 text-stone-500 hover:bg-white/[0.06] hover:text-gold-200" title="Log out" aria-label="Log out">
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );

  const sidebarBody = (
    <>
      <div className="px-6 pb-6 pt-7">{brand}</div>
      <div className="hairline-gold mx-6 mb-4 h-px opacity-40" />
      {nav}
      <div className="px-3 pb-3">
        <Link href="/sales/new" className="gold-fill flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold text-espresso shadow-lg shadow-black/30 transition-transform hover:brightness-105 active:scale-[0.98]">
          <Plus className="size-4" /> New sale
        </Link>
      </div>
      {footer}
    </>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col bg-espresso lg:flex">{sidebarBody}</aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.06] bg-espresso/95 px-4 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="gold-fill grid size-8 place-items-center rounded-full text-espresso">
            <Gem className="size-4" strokeWidth={1.75} />
          </span>
          <span className="gold-text font-display text-xl font-semibold tracking-wide">{shop}</span>
        </Link>
        <button onClick={() => setOpen(true)} className="-mr-1.5 rounded-lg p-2 text-stone-300" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      <div className={cx("fixed inset-0 z-[60] lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
        <div className={cx("absolute inset-0 bg-black/60 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <aside className={cx("absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-espresso shadow-2xl transition-transform duration-300", open ? "translate-x-0" : "-translate-x-full")}>
          <button onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-2 text-stone-500" aria-label="Close menu">
            <X className="size-5" />
          </button>
          {sidebarBody}
        </aside>
      </div>

      <main className={cx("min-w-0 flex-1 px-4 pt-5 sm:px-6 sm:pt-7 lg:px-10 lg:pb-12 lg:pt-10", formPage ? "pb-28 sm:pb-10" : "pb-28")}>
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className={cx("fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden", formPage && "hidden")}>
        <ul className="relative grid grid-cols-5">
          {TABS.slice(0, 2).map((t) => <Tab key={t.href} {...t} active={isActive(path, t.href)} />)}
          <li className="flex justify-center">
            <Link href="/sales/new" aria-label="New sale" className="gold-fill -mt-5 grid size-14 place-items-center rounded-full text-espresso shadow-lg shadow-gold-700/30 ring-4 ring-ivory">
              <Plus className="size-6" />
            </Link>
          </li>
          {TABS.slice(2).map((t) => <Tab key={t.href} {...t} active={isActive(path, t.href)} />)}
        </ul>
      </nav>
    </div>
  );
}

function Tab({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Gem; active: boolean }) {
  return (
    <li>
      <Link href={href} className={cx("flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-wider", active ? "text-ink" : "text-stone-400")}>
        <Icon className={cx("size-5", active && "text-gold-600")} strokeWidth={active ? 2 : 1.75} />
        {label}
        <span className={cx("h-0.5 w-5 rounded-full", active ? "bg-gold-500" : "bg-transparent")} />
      </Link>
    </li>
  );
}
