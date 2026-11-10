"use client";

import { useEffect, useState } from "react";
import { Button, Card, ErrorBox, Field, Input, PageHeader, Spinner, useToast } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import type { Settings } from "@/lib/types";

export default function ProfilePage() {
  const toast = useToast();
  const { data, mutate } = useApi<Settings>("/api/settings");
  const [s, setS] = useState<Record<keyof Settings, string> | null>(null);
  const [sErr, setSErr] = useState<unknown>(null);
  const [sSaving, setSSaving] = useState(false);

  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pErr, setPErr] = useState<unknown>(null);
  const [pSaving, setPSaving] = useState(false);

  useEffect(() => {
    if (data && !s) setS({ shopName: data.shopName, deliveryInsideDhaka: String(data.deliveryInsideDhaka), deliveryOutsideDhaka: String(data.deliveryOutsideDhaka), lowStockThreshold: String(data.lowStockThreshold) });
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
      <PageHeader eyebrow="Account" title="Profile & Settings" />
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
            <p className="text-xs text-stone-500">The master password (set on the server) always works for sign-in, even after you change this password.</p>
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
