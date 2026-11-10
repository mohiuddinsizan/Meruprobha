"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Spinner, useConfirm, useToast } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import type { Genre } from "@/lib/types";

type Edit = { mode: "genre" | "category"; id?: string; parent?: string; parentName?: string; name: string } | null;

export default function CategoriesPage() {
  const { data, error, mutate } = useApi<Genre[]>("/api/categories");
  const [edit, setEdit] = useState<Edit>(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<unknown>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    setFormErr(null);
    try {
      if (edit.id) await api(`/api/categories/${edit.id}`, "PATCH", { name: edit.name });
      else await api("/api/categories", "POST", { name: edit.name, parent: edit.parent ?? null });
      toast(edit.id ? "Renamed" : `${edit.mode === "genre" ? "Genre" : "Category"} added`);
      setEdit(null);
      mutate();
    } catch (err) {
      setFormErr(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!(await confirm({ title: `Delete "${name}"?`, message: "This can't be undone.", confirmText: "Delete", danger: true }))) return;
    try {
      await api(`/api/categories/${id}`, "DELETE");
      toast("Deleted");
      mutate();
    } catch (err) {
      toast((err as Error).message, "err");
    }
  };

  const open = (e: NonNullable<Edit>) => {
    setFormErr(null);
    setEdit(e);
  };

  return (
    <>
      <PageHeader
        eyebrow="Boutique" title="Genres & Categories"
        subtitle="Genres are the main product types (Bangles, Necklace…). Each genre can have its own categories."
        actions={<Button onClick={() => open({ mode: "genre", name: "" })}><Plus className="size-4" /> New genre</Button>}
      />
      <ErrorBox error={error} />
      {!data && !error && <Spinner />}
      {data && data.length === 0 && <Card><Empty title="No genres yet">Add your first genre to start adding products.</Empty></Card>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((g) => (
          <Card
            key={g._id}
            title={
              <span className="flex items-center gap-2">
                {g.name} <Badge>{g.productCount} products</Badge>
              </span>
            }
            action={
              <div className="flex gap-1">
                <IconBtn label="Rename genre" onClick={() => open({ mode: "genre", id: g._id, name: g.name })}><Pencil className="size-4" /></IconBtn>
                <IconBtn label="Delete genre" onClick={() => remove(g._id, g.name)}><Trash2 className="size-4" /></IconBtn>
              </div>
            }
          >
            <ul className="divide-y divide-stone-100">
              {g.categories.length === 0 && <li className="px-5 py-3 text-sm text-stone-400">No categories yet</li>}
              {g.categories.map((c) => (
                <li key={c._id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                  <span className="text-sm text-stone-800">
                    {c.name} <span className="text-xs text-stone-400">· {c.productCount}</span>
                  </span>
                  <div className="flex gap-1">
                    <IconBtn label="Rename category" onClick={() => open({ mode: "category", id: c._id, name: c.name, parentName: g.name })}><Pencil className="size-3.5" /></IconBtn>
                    <IconBtn label="Delete category" onClick={() => remove(c._id, c.name)}><Trash2 className="size-3.5" /></IconBtn>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-stone-100 p-3">
              <Button variant="ghost" size="sm" onClick={() => open({ mode: "category", parent: g._id, parentName: g.name, name: "" })}>
                <Plus className="size-4" /> Add category
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit ? `${edit.id ? "Rename" : "New"} ${edit.mode}${edit.parentName ? ` in ${edit.parentName}` : ""}` : ""}
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="Name" required>
            <Input value={edit?.name ?? ""} onChange={(e) => setEdit((x) => x && { ...x, name: e.target.value })} autoFocus required maxLength={60} />
          </Field>
          <ErrorBox error={formErr} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-800">
      {children}
    </button>
  );
}
