"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownToLine, History, Pencil, Plus, Power, Trash2, Users, Wallet } from "lucide-react";
import { Avatar, WithdrawModal } from "@/components/MoneyForms";
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Spinner, Stat, cx, useConfirm, useToast } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { money, num } from "@/lib/format";
import { useMe } from "@/lib/me";
import type { Account } from "@/lib/types";

type Form = { _id?: string; name: string; username: string; phone: string; password: string };

export default function PartnersPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const me = useMe();
  const isSuper = me?.role === "super";
  const { data: users, error, mutate } = useApi<Account[]>("/api/users", { revalidateOnMount: true });
  const [form, setForm] = useState<Form | null>(null);
  const [formErr, setFormErr] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [withdrawFor, setWithdrawFor] = useState<Account | null>(null);

  const active = users?.filter((u) => u.active) ?? [];
  const inAccounts = active.reduce((t, u) => t + u.balance, 0);
  const withdrawn = (users ?? []).reduce((t, u) => t + u.totalWithdrawn, 0);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormErr(null);
    try {
      if (form._id) await api(`/api/users/${form._id}`, "PATCH", form);
      else await api("/api/users", "POST", form);
      toast(form._id ? "Account updated" : `${form.name} can now sign in as @${form.username.toLowerCase()}`);
      setForm(null);
      mutate();
    } catch (x) {
      setFormErr(x);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (u: Account) => {
    const off = u.active;
    if (off && !(await confirm({ title: `Switch off ${u.name}'s account?`, message: "They're signed out and can't sign in or receive new distributions. Their balance and history stay, and you can switch it back on any time.", confirmText: "Switch off", danger: true }))) return;
    await api(`/api/users/${u._id}`, "PATCH", { active: !off });
    toast(off ? "Account switched off" : "Account switched on");
    mutate();
  };

  const remove = async (u: Account) => {
    if (!(await confirm({ title: `Delete ${u.name}'s account?`, message: "This can't be undone.", confirmText: "Delete", danger: true }))) return;
    try {
      await api(`/api/users/${u._id}`, "DELETE");
      toast("Account deleted");
      mutate();
    } catch (x) {
      toast((x as Error).message, "err");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Partners"
        subtitle="Each partner has their own login and account. Distributed profit lands here; withdrawals come out of it."
        actions={isSuper && <Button onClick={() => { setFormErr(null); setForm({ name: "", username: "", phone: "", password: "" }); }}><Plus className="size-4" /> Add partner</Button>}
      />

      <ErrorBox error={error} />
      {!users && !error && <Spinner />}
      {users && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <Stat icon={Wallet} label="In partner accounts" value={money(inAccounts)} sub="ready to withdraw" emphasis />
            <Stat icon={ArrowDownToLine} label="Withdrawn so far" value={money(withdrawn)} sub="all partners" />
            <div className="hidden sm:col-span-2 sm:block lg:col-span-1">
              <Stat icon={Users} label="Partners" value={num(active.length)} sub={users.length > active.length ? `${users.length - active.length} switched off` : "active accounts"} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {users.map((u) => {
              const self = u._id === me?._id;
              const canWithdraw = self || isSuper;
              return (
                <Card key={u._id} className={cx("flex flex-col", !u.active && "opacity-70")}>
                  <div className="flex items-start gap-3 p-4 sm:p-5">
                    <Avatar name={u.name} className="size-11 text-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{u.name}{self && <span className="font-normal text-muted"> (you)</span>}</p>
                      <p className="truncate text-xs text-muted">@{u.username}{u.phone && ` · ${u.phone}`}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge tone={u.role === "super" ? "gold" : "stone"}>{u.role === "super" ? "Super admin" : "Admin"}</Badge>
                        {!u.active && <Badge tone="red">Switched off</Badge>}
                      </div>
                    </div>
                    {isSuper && (
                      <div className="-mr-2 -mt-1 flex shrink-0">
                        <button onClick={() => { setFormErr(null); setForm({ _id: u._id, name: u.name, username: u.username, phone: u.phone, password: "" }); }} className="rounded-lg p-2 text-stone-400 hover:bg-gold-50 hover:text-ink" aria-label={`Edit ${u.name}`}><Pencil className="size-4" /></button>
                        {u.role !== "super" && (
                          <>
                            <button onClick={() => toggle(u)} className="rounded-lg p-2 text-stone-400 hover:bg-gold-50 hover:text-ink" aria-label={u.active ? `Switch off ${u.name}` : `Switch on ${u.name}`} title={u.active ? "Switch off" : "Switch on"}><Power className="size-4" /></button>
                            {u.totalReceived === 0 && <button onClick={() => remove(u)} className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${u.name}`}><Trash2 className="size-4" /></button>}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mx-4 rounded-xl bg-gold-50/60 px-4 py-3 sm:mx-5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Balance</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{money(u.balance)}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 px-4 py-3 text-sm sm:px-5">
                    <div><dt className="text-xs text-muted">Received</dt><dd className="font-medium tabular-nums">{money(u.totalReceived)}</dd></div>
                    <div><dt className="text-xs text-muted">Withdrawn</dt><dd className="font-medium tabular-nums">{money(u.totalWithdrawn)}</dd></div>
                  </dl>

                  <div className="mt-auto flex gap-2 border-t border-line/70 p-3 sm:px-5">
                    {canWithdraw && (
                      <Button size="sm" className="flex-1" disabled={u.balance <= 0} onClick={() => setWithdrawFor(u)}>
                        <ArrowDownToLine className="size-3.5" /> Withdraw
                      </Button>
                    )}
                    <Link href={`/log?user=${u._id}`} className={cx("inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-line px-3 text-xs font-medium text-stone-600 hover:border-gold-300", !canWithdraw && "flex-1")}>
                      <History className="size-3.5" /> History
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>

          <p className="text-xs text-muted">
            {isSuper
              ? "Partners can do everything you can, except add or manage partner accounts and reverse log entries. Each partner withdraws from their own account; you can also record a withdrawal for anyone."
              : "You can withdraw from your own account. Only the super admin can add or manage partner accounts."}
          </p>
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?._id ? "Edit account" : "Add partner"}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Full name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required autoFocus />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Username" required hint="Used to sign in. No spaces.">
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, "").toLowerCase() })} maxLength={30} required autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              </Field>
              <Field label="Phone">
                <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} />
              </Field>
            </div>
            <Field label={form._id ? "New password" : "Password"} required={!form._id} hint={form._id ? "Leave empty to keep the current password. Setting one signs them out." : "At least 6 characters. Share it with the partner."}>
              <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} required={!form._id} autoComplete="new-password" />
            </Field>
            <ErrorBox error={formErr} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button type="submit" loading={saving}>{form._id ? "Save" : "Create account"}</Button>
            </div>
          </form>
        )}
      </Modal>

      <WithdrawModal account={withdrawFor} self={withdrawFor?._id === me?._id} onClose={() => setWithdrawFor(null)} onDone={mutate} />
    </>
  );
}
