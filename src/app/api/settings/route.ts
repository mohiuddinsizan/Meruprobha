import { route, nonNeg, str, bad } from "@/lib/api";
import { getSettings } from "@/lib/auth";
import { Settings } from "@/lib/models";

function view(s: Awaited<ReturnType<typeof getSettings>>) {
  return {
    shopName: s.shopName,
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
      deliveryInsideDhaka: nonNeg(b.deliveryInsideDhaka, "Inside Dhaka charge"),
      deliveryOutsideDhaka: nonNeg(b.deliveryOutsideDhaka, "Outside Dhaka charge"),
      lowStockThreshold: nonNeg(b.lowStockThreshold, "Low stock alert", { int: true }),
    },
    { returnDocument: "after" }
  );
  return view(s!);
});
