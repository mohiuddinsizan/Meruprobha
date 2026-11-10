"use client";

import { useState } from "react";
import { Pencil, PieChart, Plus, Trash2, Users } from "lucide-react";
import { PartnerShares } from "@/components/PartnerShares";
import { Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Spinner, Stat, Textarea, cx, useConfirm, useToast } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { fmtDate, num } from "@/lib/format";
import { PRESETS, presetRange, type Preset } from "@/lib/ranges";
import type { Partner } from "@/lib/types";

type Form = { _id?: string; name: string; sharePct: string; phone: string; note: string };
type Report = { from: string; to: string; summary: { netProfit: number } };

const SHOWN: Preset[] = ["month", "lastmonth", "year", "lastyear", "all"];

export default function PartnersPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState<Form | null>(null);
  const [formErr, setFormErr] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [preset, setPreset] = useState<Preset>("month");

  const { data: partners, error, mutate } = useApi<Partner[]>("/api/partners");
  const [from, to] = presetRange(preset);
  const { data: report } = useApi<Report>(`/api/reports?${new URLSearchParams({ from, to })}`, { keepPreviousData: true });

  const assigned = Math.round((partners ?? []).reduce((s, p) => s + p.sharePct, 0) * 100) / 100;
  const othersPct = (id?: string) => (partners ?? []).filter((p) => p._id !== id).reduce((s, p) => s + p.sharePct, 0);
  const available = form ? Math.round((100 - othersPct(form._id)) * 100) / 100 : 0;

  const openNew = () => {
    setFormErr(null);
    setForm({ name: "", sharePct: "", phone: "", note: "" });
  };
  const openEdit = (p: Partner) => {
    setFormErr(null);
    setForm({ _id: p._id, name: p.name, sharePct: String(p.sharePct), phone: p.phone, note: p.note });
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormErr(null);
    try {
      if (form._id) await api(`/api/partners/${form._id}`, "PATCH", form);
      else await api("/api/partners", "POST", form);
      toast(form._id ? "Partner updated" : "Partner added");
      setForm(null);
      mutate();
    } catch (err) {
      setFormErr(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Partner) => {
    if (!(await confirm({ title: `Remove ${p.name}?`, message: `Their ${+p.sharePct.toFixed(2)}% share becomes unassigned.`, confirmText: "Remove", danger: true }))) return;
    await api(`/api/partners/${p._id}`, "DELETE");
    toast("Partner removed");
    mutate();
  };

  return (
    <>
      <PageHeader
        eyebrow="Boutique"
        title="Partners"
        subtitle="Who owns what share of the business. Reports split the net profit using these percentages."
        actions={<Button onClick={openNew}><Plus className="size-4" /> Add partner</Button>}
      />

      <ErrorBox error={error} />
      {!partners && !error && <Spinner />}
      {partners && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <Stat icon={PieChart} label="Shares assigned" value={`${+assigned.toFixed(2)}%`} sub={assigned === 100 ? "fully distributed" : `${+(100 - assigned).toFixed(2)}% stays with the shop`} emphasis />
            <Stat icon={Users} label="Partners" value={num(partners.length)} />
            <div className="col-span-2 lg:col-span-1"><Stat label="Largest share" value={partners[0] ? `${+partners[0].sharePct.toFixed(2)}%` : "—"} sub={partners[0]?.name ?? "No partners yet"} /></div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Card title="Partners" className="min-w-0 lg:col-span-3">
              {partners.length === 0 ? (
                <Empty title="No partners yet">
                  <button onClick={openNew} className="font-medium text-gold-700 underline-offset-4 hover:underline">Add the first partner</button>
                </Empty>
              ) : (
                <ul className="divide-y divide-line/70">
                  {partners.map((p) => {
                    const last = p.shareHistory.at(-1);
                    return (
                      <li key={p._id} className="flex items-start gap-3 px-4 py-4 sm:px-5">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink font-display text-lg font-semibold text-gold-300">{p.name.charAt(0).toUpperCase()}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{p.name}</p>
                          {p.phone && <p className="text-xs text-muted">{p.phone}</p>}
                          {p.note && <p className="mt-1 text-sm text-stone-600">{p.note}</p>}
                          <p className="mt-1 text-xs text-stone-400">
                            {last ? `Changed from ${+last.from.toFixed(2)}% on ${fmtDate(last.at)}` : `Added ${fmtDate(p.createdAt)}`}
                          </p>
                        </div>
                        <span className="shrink-0 font-display text-2xl font-semibold tabular-nums">{+p.sharePct.toFixed(2)}%</span>
                        <div className="flex shrink-0">
                          <button onClick={() => openEdit(p)} className="rounded-lg p-2 text-stone-400 hover:bg-gold-50 hover:text-ink" aria-label={`Edit ${p.name}`}><Pencil className="size-4" /></button>
                          <button onClick={() => remove(p)} className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${p.name}`}><Trash2 className="size-4" /></button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <div className="min-w-0 space-y-3 lg:col-span-2">
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                {PRESETS.filter((x) => SHOWN.includes(x.k)).map((x) => (
                  <button
                    key={x.k}
                    onClick={() => setPreset(x.k)}
                    className={cx("h-8 shrink-0 rounded-full border px-3.5 text-xs font-medium transition-colors", preset === x.k ? "border-ink bg-ink text-gold-50" : "border-line bg-white text-stone-600 hover:border-gold-300")}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
              {report ? (
                <PartnerShares netProfit={report.summary.netProfit} partners={partners} title="Who receives what" manage={false} />
              ) : (
                <Spinner />
              )}
            </div>
          </div>
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?._id ? "Edit partner" : "Add partner"}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Share (%)" required hint={`${+available.toFixed(2)}% available`}>
                <Input type="number" min={0} max={available} step="0.01" inputMode="decimal" value={form.sharePct} onChange={(e) => setForm({ ...form, sharePct: e.target.value })} required />
              </Field>
              <Field label="Phone">
                <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} />
              </Field>
            </div>
            <Field label="Note">
              <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} placeholder="e.g. Invested ৳50,000 in March" />
            </Field>
            <ErrorBox error={formErr} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button type="submit" loading={saving}>{form._id ? "Save" : "Add partner"}</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
