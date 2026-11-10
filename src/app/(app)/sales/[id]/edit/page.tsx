"use client";

import { use } from "react";
import { OrderForm } from "@/components/OrderForm";
import { ErrorBox, PageHeader, Spinner } from "@/components/ui";
import { useApi } from "@/lib/client";
import type { Order } from "@/lib/types";

export default function EditSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error } = useApi<Order>(`/api/orders/${id}`, { revalidateOnMount: true });
  return (
    <>
      <PageHeader
        title={data ? `Edit sale #${data.orderNo}` : "Edit sale"}
        subtitle="Changing products or quantities adjusts inventory automatically."
        back={`/sales/${id}`}
      />
      <ErrorBox error={error} />
      {!data && !error && <Spinner />}
      {data && <OrderForm order={data} />}
    </>
  );
}
