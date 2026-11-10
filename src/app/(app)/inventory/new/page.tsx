import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/ProductForm";

export default function NewProductPage() {
  return (
    <>
      <PageHeader title="Add product" back="/inventory" />
      <ProductForm />
    </>
  );
}
