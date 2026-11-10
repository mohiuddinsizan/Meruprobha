import { OrderForm } from "@/components/OrderForm";
import { PageHeader } from "@/components/ui";

export default function NewSalePage() {
  return (
    <>
      <PageHeader title="New sale" subtitle="Stock is taken from inventory as soon as you save." back="/sales" />
      <OrderForm />
    </>
  );
}
