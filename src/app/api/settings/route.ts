import { route, nonNeg, str, bad } from "@/lib/api";
import { getSettings } from "@/lib/auth";
import { Settings } from "@/lib/models";

function view(s: Awaited<ReturnType<typeof getSettings>>) {
  return {
    shopName: s.shopName,
    shopAddress: s.shopAddress ?? "",
    shopPhone: s.shopPhone ?? "",
    shopEmail: s.shopEmail ?? "",
    shopWebsite: s.shopWebsite ?? "",
    invoiceNote: s.invoiceNote ?? "",
    deliveryInsideDhaka: s.deliveryInsideDhaka,
    deliveryOutsideDhaka: s.deliveryOutsideDhaka,
    lowStockThreshold: s.lowStockThreshold,
  };
}

export const GET = route(async () => view(await getSettings()));

export const PATCH = route(async (req) => {
  const b = await req.json();
  const shopName = str(b.shopName, 80);
  if (!shopName) throw bad("Shop name is required");
  await getSettings();
  const s = await Settings.findByIdAndUpdate(
    "main",
    {
      shopName,
      shopAddress: str(b.shopAddress, 300),
      shopPhone: str(b.shopPhone, 60),
      shopEmail: str(b.shopEmail, 120),
      shopWebsite: str(b.shopWebsite, 200),
      invoiceNote: str(b.invoiceNote, 500),
      deliveryInsideDhaka: nonNeg(b.deliveryInsideDhaka, "Inside Dhaka charge"),
      deliveryOutsideDhaka: nonNeg(b.deliveryOutsideDhaka, "Outside Dhaka charge"),
      lowStockThreshold: nonNeg(b.lowStockThreshold, "Low stock alert", { int: true }),
    },
    { returnDocument: "after" }
  );
  return view(s!);
});
