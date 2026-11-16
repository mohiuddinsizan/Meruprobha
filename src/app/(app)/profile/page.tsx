"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, ErrorBox, Field, Input, PageHeader, Spinner, Textarea, useToast } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { useMe } from "@/lib/me";
import type { Settings } from "@/lib/types";

export default function ProfilePage() {
  const toast = useToast();
  const me = useMe();
  const { data, mutate } = useApi<Settings>("/api/settings");
  const [s, setS] = useState<Record<keyof Settings, string> | null>(null);
  const [sErr, setSErr] = useState<unknown>(null);
  const [sSaving, setSSaving] = useState(false);

  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pErr, setPErr] = useState<unknown>(null);
  const [pSaving, setPSaving] = useState(false);

  useEffect(() => {
    if (data && !s) setS({ shopName: data.shopName, shopAddress: data.shopAddress, shopPhone: data.shopPhone, shopEmail: data.shopEmail, shopWebsite: data.shopWebsite, invoiceNote: data.invoiceNote, deliveryInsideDhaka: String(data.deliveryInsideDhaka), deliveryOutsideDhaka: String(data.deliveryOutsideDhaka), lowStockThreshold: String(data.lowStockThreshold) });
  }, [data, s]);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSErr(null);
    setSSaving(true);
    try {
      await mutate(await api<Settings>("/api/settings", "PATCH", s), { revalidate: false });
      toast("Settings saved");
    } catch (err) {
      setSErr(err);
    } finally {
      setSSaving(false);
    }
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPErr(null);
    if (pw.newPassword !== pw.confirm) return setPErr("New passwords don't match");
    setPSaving(true);
    try {
      await api("/api/profile/password", "POST", pw);
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      toast("Password changed. Other devices have been signed out.");
    } catch (err) {
      setPErr(err);
    } finally {
      setPSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Profile & Settings"
        subtitle={me && (
          <span className="flex flex-wrap items-center gap-2">
            Signed in as <b className="font-medium text-ink">{me.name}</b> · @{me.username}
            <Badge tone={me.role === "super" ? "gold" : "stone"}>{me.role === "super" ? "Super admin" : "Admin"}</Badge>
          </span>
        )}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Change password">
          <form onSubmit={changePw} className="space-y-4 p-5">
            <Field label="Current password" required>
              <Input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required autoComplete="current-password" />
            </Field>
            <Field label="New password" required hint="At least 6 characters">
              <Input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={6} autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password" required>
              <Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required minLength={6} autoComplete="new-password" />
            </Field>
            <ErrorBox error={pErr} />
            <Button type="submit" loading={pSaving}>Change password</Button>
            <p className="text-xs text-stone-500">The master password (set on the server) always works for sign-in to any account, even after a password change.</p>
          </form>
        </Card>

        <Card title="Shop settings">
          {!s ? (
            <Spinner />
          ) : (
            <form onSubmit={saveSettings} className="space-y-4 p-5">
              <Field label="Shop name" required>
                <Input value={s.shopName} onChange={(e) => setS({ ...s, shopName: e.target.value })} required />
              </Field>
              <Field label="Shop address" hint="Shown on invoices">
                <Textarea rows={2} value={s.shopAddress} onChange={(e) => setS({ ...s, shopAddress: e.target.value })} placeholder="House, road, area, city" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Shop phone">
                  <Input value={s.shopPhone} onChange={(e) => setS({ ...s, shopPhone: e.target.value })} placeholder="01XXXXXXXXX" />
                </Field>
                <Field label="Shop email">
                  <Input type="email" value={s.shopEmail} onChange={(e) => setS({ ...s, shopEmail: e.target.value })} />
                </Field>
              </div>
              <Field label="Website or Facebook page">
                <Input value={s.shopWebsite} onChange={(e) => setS({ ...s, shopWebsite: e.target.value })} placeholder="facebook.com/meruprobha" />
              </Field>
              <Field label="Invoice footer note" hint="Return/exchange policy or a thank-you line, printed at the bottom of every invoice">
                <Textarea rows={2} value={s.invoiceNote} onChange={(e) => setS({ ...s, invoiceNote: e.target.value })} placeholder="Products can be exchanged within 3 days with this invoice." />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Delivery charge inside Dhaka (৳)" hint="Pre-filled on new sales">
                  <Input type="number" min={0} value={s.deliveryInsideDhaka} onChange={(e) => setS({ ...s, deliveryInsideDhaka: e.target.value })} required />
                </Field>
                <Field label="Delivery charge outside Dhaka (৳)">
                  <Input type="number" min={0} value={s.deliveryOutsideDhaka} onChange={(e) => setS({ ...s, deliveryOutsideDhaka: e.target.value })} required />
                </Field>
              </div>
              <Field label="Low stock alert at (pieces)" hint="Products at or below this are flagged">
                <Input type="number" min={0} step={1} value={s.lowStockThreshold} onChange={(e) => setS({ ...s, lowStockThreshold: e.target.value })} required />
              </Field>
              <ErrorBox error={sErr} />
              <Button type="submit" loading={sSaving}>Save settings</Button>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
