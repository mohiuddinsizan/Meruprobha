"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { Button, Card, ErrorBox, Field, Input, Select, Spinner, Textarea, cx, useToast } from "./ui";
import { api, imgUrl, uploadImage, useApi } from "@/lib/client";
import { money } from "@/lib/format";
import type { Genre, Product } from "@/lib/types";

type Form = {
  name: string;
  genre: string;
  category: string;
  buyingPrice: string;
  sellingPrice: string;
  quantity: string;
  description: string;
  images: string[];
};

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const toast = useToast();
  const { data: genres } = useApi<Genre[]>("/api/categories");
  const [f, setF] = useState<Form>({
    name: product?.name ?? "",
    genre: product?.genre?._id ?? "",
    category: product?.category?._id ?? "",
    buyingPrice: product ? String(product.buyingPrice) : "",
    sellingPrice: product?.sellingPrice != null ? String(product.sellingPrice) : "",
    quantity: product ? String(product.quantity) : "",
    description: product?.description ?? "",
    images: product?.images ?? [],
  });
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const genre = genres?.find((g) => g._id === f.genre);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 10 - f.images.length);
    setUploading((n) => n + list.length);
    await Promise.all(
      list.map(async (file) => {
        try {
          const id = await uploadImage(file);
          setF((x) => ({ ...x, images: [...x.images, id] }));
        } catch (e) {
          toast(`${file.name}: ${(e as Error).message}`, "err");
        } finally {
          setUploading((n) => n - 1);
        }
      })
    );
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = { ...f, sellingPrice: f.sellingPrice === "" ? null : f.sellingPrice, category: f.category || null };
      if (product) {
        const r = await api<{ changed: boolean }>(`/api/products/${product._id}`, "PATCH", body);
        toast(r.changed ? "Product updated" : "Nothing changed");
        router.push(`/inventory/${product._id}`);
      } else {
        const r = await api<{ _id: string }>("/api/products", "POST", body);
        toast("Product added");
        router.push(`/inventory/${r._id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  if (!genres) return <Spinner />;

  const buy = Number(f.buyingPrice);
  const sell = Number(f.sellingPrice);
  const margin = f.sellingPrice !== "" && f.buyingPrice !== "" ? sell - buy : null;

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
      <div className="min-w-0 space-y-6 lg:col-span-2">
        <Card title="Product details">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Genre" required>
              <Select value={f.genre} onChange={(e) => setF((x) => ({ ...x, genre: e.target.value, category: "" }))} required>
                <option value="">Select genre</option>
                {genres.map((g) => (
                  <option key={g._id} value={g._id}>{g.name}</option>
                ))}
              </Select>
            </Field>
            <Field
              label="Category"
              required={!!genre?.categories.length}
              hint={genre && !genre.categories.length ? "This genre has no categories" : undefined}
            >
              <Select value={f.category} onChange={(e) => set("category", e.target.value)} required={!!genre?.categories.length} disabled={!genre?.categories.length}>
                <option value="">{genre ? "Select category" : "Select a genre first"}</option>
                {genre?.categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Product name" required className="sm:col-span-2">
              <Input value={f.name} onChange={(e) => set("name", e.target.value)} required maxLength={150} placeholder="e.g. Gold plated kundan bangle set" />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={4} placeholder="Material, size, weight, colour, any notes…" />
            </Field>
          </div>
        </Card>

        <Card title={`Images (${f.images.length}/10)`}>
          <div className="grid grid-cols-3 gap-3 p-5 sm:grid-cols-5">
            {f.images.map((id, i) => (
              <div key={id} className="group relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl(id)} alt="" className="size-full object-cover" />
                {i === 0 && <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">Cover</span>}
                <div className="absolute right-1 top-1 flex gap-1">
                  {i > 0 && (
                    <button type="button" title="Make cover" onClick={() => set("images", [id, ...f.images.filter((x) => x !== id)])} className="rounded bg-white/90 p-1 text-stone-700 shadow">
                      <Star className="size-3.5" />
                    </button>
                  )}
                  <button type="button" title="Remove" onClick={() => set("images", f.images.filter((x) => x !== id))} className="rounded bg-white/90 p-1 text-red-600 shadow">
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {Array.from({ length: uploading }).map((_, i) => (
              <div key={`u${i}`} className="grid aspect-square place-items-center rounded-lg border border-dashed border-stone-300 text-stone-400">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ))}
            {f.images.length + uploading < 10 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="grid aspect-square place-items-center rounded-lg border border-dashed border-stone-300 text-stone-400 hover:border-gold-500 hover:text-gold-600"
              >
                <span className="flex flex-col items-center gap-1 text-xs">
                  <ImagePlus className="size-6" /> Add
                </span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        </Card>
      </div>

      <div className="min-w-0 space-y-6">
        <Card title="Price & stock">
          <div className="space-y-4 p-5">
            <Field label="Buying price (৳)" required hint="What you paid per piece. Used to calculate profit.">
              <Input type="number" min={0} step="0.01" inputMode="decimal" value={f.buyingPrice} onChange={(e) => set("buyingPrice", e.target.value)} required />
            </Field>
            <Field label="Selling price (৳)" hint="Optional. Pre-fills the price when you add a sale; you can still change it per sale.">
              <Input type="number" min={0} step="0.01" inputMode="decimal" value={f.sellingPrice} onChange={(e) => set("sellingPrice", e.target.value)} />
            </Field>
            {margin !== null && (
              <p className={cx("rounded-lg px-3 py-2 text-sm", margin >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>
                Profit per piece: <b>{money(margin)}</b>
                {buy > 0 && ` (${((margin / buy) * 100).toFixed(0)}% on cost)`}
              </p>
            )}
            <Field label="Quantity in stock" required>
              <Input type="number" min={0} step={1} inputMode="numeric" value={f.quantity} onChange={(e) => set("quantity", e.target.value)} required />
            </Field>
          </div>
        </Card>
        <ErrorBox error={error} />
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-line bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <Button type="submit" loading={saving} disabled={uploading > 0} className="flex-1">
            {product ? "Save changes" : "Add product"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        </div>
      </div>
    </form>
  );
}
