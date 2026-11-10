"use client";

import { use } from "react";
import { ErrorBox, PageHeader, Spinner } from "@/components/ui";
import { ProductForm } from "@/components/ProductForm";
import { useApi } from "@/lib/client";
import type { Product } from "@/lib/types";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error } = useApi<Product>(`/api/products/${id}`, { revalidateOnMount: true });
  return (
    <>
      <PageHeader title={data ? `Edit: ${data.name}` : "Edit product"} subtitle="Every change is recorded in the product's history." back={`/inventory/${id}`} />
      <ErrorBox error={error} />
      {!data && !error && <Spinner />}
      {data && <ProductForm product={data} />}
    </>
  );
}
