import { route } from "@/lib/api";
import { Order } from "@/lib/models";
import { normalizePhone } from "@/lib/orders";

/** Looks up a returning customer by phone to auto-fill the sale form. */
export const GET = route(async (req) => {
  const phone = normalizePhone(new URL(req.url).searchParams.get("phone"));
  if (!/^01\d{9}$/.test(phone)) return { customer: null };
  const [last, count] = await Promise.all([
    Order.findOne({ "customer.phone": phone }).sort({ saleDate: -1 }).select("customer delivery").lean(),
    Order.countDocuments({ "customer.phone": phone, status: { $ne: "cancelled" } }),
  ]);
  return { customer: last ? { ...last.customer, delivery: last.delivery, orders: count } : null };
});
