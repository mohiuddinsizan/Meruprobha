"use client";

import { useState } from "react";
import { Pencil, Plus, Settings2, Trash2, Wallet } from "lucide-react";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Stat, Textarea, cx, useConfirm, useToast } from "@/components/ui";
import { PeriodPicker } from "@/components/PeriodPicker";
import { api, useApi } from "@/lib/client";
import { toYmd, todayYmd } from "@/lib/dates";
import { fmtDate, money, num } from "@/lib/format";
import { PRESETS, presetRange, type Preset } from "@/lib/ranges";

type Cat = { _id: string; name: string; count: number };
type Expense = { _id: string; date: string; category: string; categoryName: string; amount: number; note: string };
type Res = { expenses: Expense[]; total: number; byCategory: { _id: string; name: string; total: number; count: number }[] };
type Form = { _id?: string; category: string; date: string; amount: string; note: string };

const SHOWN: Preset[] = ["month", "lastmonth", "30d", "year", "all"];

export default function ExpensesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [preset, setPreset] = useState<Preset>("month");
  const [range, setRange] = useState<[string, string]>(presetRange("month"));
  const [category, setCategory] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [formErr, setFormErr] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);

  const { data: cats, mutate: mutateCats } = useApi<Cat[]>("/api/expense-categories");
  const params = new URLSearchParams({ from: range[0], to: range[1], category });
  const { data, error, mutate, isLoading } = useApi<Res>(`/api/expenses?${params}`, { keepPreviousData: true, revalidateOnMount: true });

  const choose = (p: Preset) => { setPreset(p); setRange(presetRange(p)); };
  const custom = (from: string, to: string) => { setPreset("custom"); setRange([from, to]); };

  const openNew = () => {
    setFormErr(null);
    setForm({ category: category || "", date: todayYmd(), amount: "", note: "" });
  };
  const openEdit = (e: Expense) => {
    setFormErr(null);
    setForm({ _id: e._id, category: e.category, date: toYmd(e.date), amount: String(e.amount), note: e.note });
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormErr(null);
    try {
      if (form._id) await api(`/api/expenses/${form._id}`, "PATCH", form);
      else await api("/api/expenses", "POST", form);
      toast(form._id ? "Expense updated" : "Expense added");
      setForm(null);
      mutate();
      mutateCats();
    } catch (err) {
      setFormErr(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (e: Expense) => {
    if (!(await confirm({ title: "Delete this expense?", message: `${e.categoryName} · ${money(e.amount)} on ${fmtDate(e.date)}`, confirmText: "Delete", danger: true }))) return;
    await api(`/api/expenses/${e._id}`, "DELETE");
    toast("Expense deleted");
    mutate();
    mutateCats();
  };

  const top = data?.byCategory[0];

  return (
    <>
      <PageHeader
        eyebrow="Boutique"
        title="Expenses"
        subtitle="Shop costs like food, transport and ads. They're subtracted from profit in your reports."
        actions={
          <>
            <Button variant="secondary" onClick={() => setCatsOpen(true)}><Settings2 className="size-4" /> Categories</Button>
            <Button onClick={openNew}><Plus className="size-4" /> Add expense</Button>
          </>
        }
      />

      <div className="mb-5 flex gap-2 sm:hidden">
        <PeriodPicker preset={preset} range={range} onPreset={choose} onRange={custom} className="flex-1" />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
          className={cx("h-12 w-[38%] min-w-0 rounded-2xl border bg-white px-3 text-sm shadow-[0_1px_2px_rgba(26,22,19,0.04)] focus:outline-none", category ? "border-ink font-medium text-ink" : "border-line text-stone-700")}
        >
          <option value="">All types</option>
          {cats?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </div>

      <Card className="mb-5 hidden sm:block">
        <div className="space-y-3 p-3 sm:p-4">
          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {PRESETS.filter((p) => SHOWN.includes(p.k)).map((p) => (
              <button
                key={p.k}
                onClick={() => choose(p.k)}
                className={cx("h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors", preset === p.k ? "border-ink bg-ink text-gold-50" : "border-line bg-white text-stone-600 hover:border-gold-300")}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-[auto_220px] sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm">
              <Input type="date" value={range[0]} onChange={(e) => custom(e.target.value, range[1] || todayYmd())} aria-label="From date" className="min-w-0 sm:w-auto" />
              <span className="text-stone-400">–</span>
              <Input type="date" value={range[1]} onChange={(e) => custom(range[0] || e.target.value, e.target.value)} aria-label="To date" className="min-w-0 sm:w-auto" />
            </label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {cats?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          </div>
        </div>
      </Card>

      <ErrorBox error={error} />
      {!data && !error && <Spinner />}
      {data && (
        <div className={cx("space-y-6 transition-opacity", isLoading && "opacity-60")}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <Stat icon={Wallet} label="Total expenses" value={money(data.total)} sub={`${num(data.expenses.length)} entries`} emphasis />
            <Stat label="Biggest cost" value={top ? money(top.total) : "—"} sub={top ? top.name : "No expenses yet"} />
            <div className="hidden sm:col-span-2 sm:block lg:col-span-1"><Stat label="Categories used" value={num(data.byCategory.length)} sub={`of ${cats?.length ?? 0} categories`} /></div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card title="By category">
              {data.byCategory.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-stone-400">Nothing in this period</p>
              ) : (
                <ul className="space-y-4 p-5">
                  {data.byCategory.map((c) => {
                    const pct = data.total > 0 ? (c.total / data.total) * 100 : 0;
                    return (
                      <li key={c._id}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate font-medium">{c.name}</span>
                          <span className="shrink-0 font-semibold tabular-nums">{money(c.total)}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-ivory">
                            <div className="h-1.5 rounded-full bg-series-2" style={{ width: `${Math.max(pct, 1)}%` }} />
                          </div>
                          <span className="w-16 text-right text-xs tabular-nums text-muted">{pct.toFixed(0)}% · {c.count}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card title="Entries" className="min-w-0 lg:col-span-2">
              {data.expenses.length === 0 ? (
                <Empty title="No expenses in this period">
                  <button onClick={openNew} className="font-medium text-gold-700 underline-offset-4 hover:underline">Add an expense</button>
                </Empty>
              ) : (
                <ul className="divide-y divide-line/70">
                  {data.expenses.map((e) => (
                    <li key={e._id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <div className="hidden w-24 shrink-0 text-xs text-muted sm:block">{fmtDate(e.date)}</div>
                      <div className="min-w-0 flex-1">
                        <Badge tone="gold" className="max-w-full"><span className="truncate">{e.categoryName}</span></Badge>
                        {e.note && <p className="mt-1 truncate text-sm text-stone-600">{e.note}</p>}
                        <p className="mt-0.5 text-xs text-muted sm:hidden">{fmtDate(e.date)}</p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">{money(e.amount)}</span>
                      <div className="flex shrink-0">
                        <button onClick={() => openEdit(e)} className="rounded-lg p-2 text-stone-400 hover:bg-gold-50 hover:text-ink" aria-label="Edit"><Pencil className="size-4" /></button>
                        <button onClick={() => remove(e)} className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete"><Trash2 className="size-4" /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?._id ? "Edit expense" : "Add expense"}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Category" required hint={<button type="button" onClick={() => setCatsOpen(true)} className="text-gold-700 hover:underline">+ Add or edit categories</button>}>
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required autoFocus>
                <option value="">Select category</option>
                {cats?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" required>
                <Input type="date" value={form.date} max={todayYmd()} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </Field>
              <Field label="Amount (৳)" required>
                <Input type="number" min={0.01} step="0.01" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </Field>
            </div>
            <Field label="Note">
              <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} placeholder="e.g. Facebook boost for new bangle collection" />
            </Field>
            <ErrorBox error={formErr} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button type="submit" loading={saving}>{form._id ? "Save" : "Add expense"}</Button>
            </div>
          </form>
        )}
      </Modal>

      <CategoriesModal open={catsOpen} onClose={() => setCatsOpen(false)} cats={cats} onChange={() => { mutateCats(); mutate(); }} />
    </>
  );
}

function CategoriesModal({ open, onClose, cats, onChange }: { open: boolean; onClose: () => void; cats?: Cat[]; onChange: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [err, setErr] = useState<unknown>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await api("/api/expense-categories", "POST", { name });
      setName("");
      toast("Category added");
      onChange();
    } catch (x) {
      setErr(x);
    }
  };
  const rename = async () => {
    if (!editing) return;
    setErr(null);
    try {
      await api(`/api/expense-categories/${editing.id}`, "PATCH", { name: editing.name });
      setEditing(null);
      onChange();
    } catch (x) {
      setErr(x);
    }
  };
  const del = async (c: Cat) => {
    if (!(await confirm({ title: `Delete "${c.name}"?`, message: "This can't be undone.", confirmText: "Delete", danger: true }))) return;
    try {
      await api(`/api/expense-categories/${c._id}`, "DELETE");
      onChange();
    } catch (x) {
      toast((x as Error).message, "err");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Expense categories">
      <form onSubmit={add} className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category, e.g. Photography" maxLength={60} required />
        <Button type="submit"><Plus className="size-4" /> Add</Button>
      </form>
      <div className="mt-3"><ErrorBox error={err} /></div>
      <ul className="mt-3 divide-y divide-line/70 rounded-xl border border-line">
        {cats?.map((c) => (
          <li key={c._id} className="flex items-center gap-2 px-3 py-2">
            {editing?.id === c._id ? (
              <>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-9" autoFocus onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), rename())} />
                <Button size="sm" onClick={rename}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{c.name} <span className="text-xs text-stone-400">· {c.count}</span></span>
                <button onClick={() => setEditing({ id: c._id, name: c.name })} className="rounded-lg p-1.5 text-stone-400 hover:bg-gold-50 hover:text-ink" aria-label="Rename"><Pencil className="size-3.5" /></button>
                <button onClick={() => del(c)} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete"><Trash2 className="size-3.5" /></button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
