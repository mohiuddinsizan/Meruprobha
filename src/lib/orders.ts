import mongoose, { Types, type ClientSession } from "mongoose";
import { bad, nonNeg, str } from "./api";
import { ALL_DISTRICTS, ORDER_SOURCES, ORDER_STATUSES, PAYMENT_METHODS, type OrderStatus } from "./constants";
import { isYmd, saleDateFromYmd, toYmd } from "./dates";
import { Category, Product, type OrderDoc, type OrderItemDoc } from "./models";

export type OrderItem = OrderItemDoc;

/** Normalises Bangladeshi mobile numbers to 01XXXXXXXXX. */
export function normalizePhone(raw: unknown): string {
  let p = String(raw ?? "").replace(/[\s\-()]/g, "");
  if (p.startsWith("+880")) p = p.slice(3);
  else if (p.startsWith("880")) p = p.slice(2);
  return p;
}

/**
 * Validates an order form body. `prev` is the existing order when editing, so
 * products already on it keep the buying price captured at the original sale.
 */
export async function parseOrder(b: Record<string, unknown>, prev?: OrderDoc) {
  const customer = (b.customer ?? {}) as Record<string, unknown>;
  const delivery = (b.delivery ?? {}) as Record<string, unknown>;
  const courier = (b.courier ?? {}) as Record<string, unknown>;

  const name = str(customer.name, 120);
  if (!name) throw bad("Customer name is required");
  const phone = normalizePhone(customer.phone);
  if (!/^01\d{9}$/.test(phone)) throw bad("Phone must be a valid number like 01XXXXXXXXX");
  const altPhone = customer.altPhone ? normalizePhone(customer.altPhone) : "";
  if (altPhone && !/^01\d{9}$/.test(altPhone)) throw bad("Alternative phone is not valid");

  const city = str(delivery.city, 60);
  if (!ALL_DISTRICTS.includes(city)) throw bad("Select a delivery city");

  const paymentMethod = str(b.paymentMethod, 40);
  if (!(PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) throw bad("Select a payment type");
  const source = str(b.source, 40);
  if (source && !(ORDER_SOURCES as readonly string[]).includes(source)) throw bad("Invalid order source");

  if (!isYmd(b.saleDate)) throw bad("Sale date is required");
  const saleDate = prev && toYmd(prev.saleDate) === b.saleDate ? prev.saleDate : saleDateFromYmd(b.saleDate);

  // Items
  const rawItems = Array.isArray(b.items) ? b.items : [];
  if (!rawItems.length) throw bad("Add at least one product");
  const ids = rawItems.map((i) => String((i as Record<string, unknown>).product));
  if (!ids.every((id) => mongoose.isValidObjectId(id))) throw bad("Invalid product in items");
  const products = await Product.find({ _id: { $in: ids } }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const catIds = [...new Set(products.flatMap((p) => [p.genre, p.category]).filter(Boolean).map(String))];
  const catNames = new Map((await Category.find({ _id: { $in: catIds } }).lean()).map((c) => [String(c._id), c.name]));
  const prevCost = new Map((prev?.items ?? []).map((i) => [String(i.product), i.unitCost]));

  const items: OrderItem[] = rawItems.map((raw, idx) => {
    const r = raw as Record<string, unknown>;
    const p = byId.get(String(r.product));
    if (!p) throw bad(`Item ${idx + 1}: product not found`);
    if (p.archived && !prevCost.has(String(p._id))) throw bad(`${p.name} is archived`);
    const quantity = nonNeg(r.quantity, `${p.name} quantity`, { int: true })!;
    if (quantity < 1) throw bad(`${p.name}: quantity must be at least 1`);
    return {
      product: p._id,
      code: p.code,
      name: p.name,
      genre: p.genre,
      genreName: catNames.get(String(p.genre)) ?? "",
      category: p.category ?? null,
      categoryName: p.category ? catNames.get(String(p.category)) ?? "" : "",
      quantity,
      unitPrice: nonNeg(r.unitPrice, `${p.name} selling price`)!,
      unitCost: prevCost.get(String(p._id)) ?? p.buyingPrice,
    };
  });

  const subtotal = round(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const discount = nonNeg(b.discount ?? 0, "Discount")!;
  if (discount > subtotal) throw bad("Discount can't be more than the products total");
  const deliveryCharge = nonNeg(b.deliveryCharge ?? 0, "Delivery charge")!;
  const deliveryChargeCollected = b.deliveryChargeCollected !== false;
  const total = round(subtotal - discount + (deliveryChargeCollected ? deliveryCharge : 0));
  const amountPaid = nonNeg(b.amountPaid ?? 0, "Paid amount")!;
  if (amountPaid > total) throw bad("Paid amount can't be more than the total payable");

  const status = (str(b.status, 30) || "packaging") as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) throw bad("Invalid order status");

  return {
    status,
    fields: {
      saleDate,
      customer: { name, phone, altPhone },
      delivery: { city, address: str(delivery.address, 1000) },
      items,
      subtotal,
      discount,
      deliveryCharge,
      deliveryChargeCollected,
      total,
      paymentMethod,
      amountPaid,
      due: round(total - amountPaid),
      courier: { name: str(courier.name, 60), trackingId: str(courier.trackingId, 100) },
      source,
      notes: str(b.notes, 2000),
    },
  };
}

export const round = (n: number) => Math.round(n * 100) / 100;

/** Sums item quantities per product id. */
export function qtyByProduct(items: { product: Types.ObjectId | string; quantity: number }[]) {
  const m = new Map<string, number>();
  for (const i of items) m.set(String(i.product), (m.get(String(i.product)) ?? 0) + i.quantity);
  return m;
}

/**
 * Applies stock changes atomically inside a transaction. Positive delta returns
 * stock, negative deducts it; a deduction fails if stock would go below zero.
 */
export async function applyStock(
  deltas: Map<string, number>,
  session: ClientSession,
  log: { type: string; orderId: Types.ObjectId; orderNo: number; note: string }
) {
  for (const [id, delta] of deltas) {
    if (!delta) continue;
    const entry = {
      type: log.type,
      orderId: log.orderId,
      qtyChange: delta,
      note: `${log.note} (Order #${log.orderNo}): ${delta > 0 ? "+" : ""}${delta}`,
      at: new Date(),
    };
    const res = await Product.updateOne(
      delta < 0 ? { _id: id, quantity: { $gte: -delta } } : { _id: id },
      { $inc: { quantity: delta }, $push: { history: entry } },
      { session }
    );
    if (res.matchedCount === 0) {
      const p = await Product.findById(id).session(session).lean();
      if (!p) throw bad("A product in this order no longer exists");
      throw bad(`Not enough stock for "${p.name}" — only ${p.quantity} left, need ${-delta}`);
    }
  }
}

export async function withTxn<T>(fn: (s: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let out: T;
    await session.withTransaction(async () => {
      out = await fn(session);
    });
    return out!;
  } finally {
    await session.endSession();
  }
}
