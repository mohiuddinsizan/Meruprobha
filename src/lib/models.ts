/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Schema, Types, type Model } from "mongoose";

type Id = Types.ObjectId;
export interface SettingsDoc {
  _id: string;
  passwordHash: string;
  sessionVersion: number;
  shopName: string;
  deliveryInsideDhaka: number;
  deliveryOutsideDhaka: number;
  lowStockThreshold: number;
  distributedTotal: number;
  lastDistributedUpTo: Date | null;
}
export interface CategoryDoc { _id: Id; name: string; key: string; parent: Id | null }
export interface HistoryEntry {
  at?: Date;
  type: string;
  note?: string;
  orderId?: Id;
  qtyChange?: number;
  changes?: { field: string; from: unknown; to: unknown }[];
}
export interface ProductDoc {
  _id: Id;
  code: string;
  name: string;
  genre: Id;
  category: Id | null;
  buyingPrice: number;
  sellingPrice: number | null;
  quantity: number;
  description: string;
  images: Id[];
  archived: boolean;
  lastEditedAt: Date | null;
  history: HistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}
export interface OrderItemDoc {
  product: Id;
  code: string;
  name: string;
  genre: Id;
  genreName: string;
  category: Id | null;
  categoryName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}
export interface OrderDoc {
  _id: Id;
  orderNo: number;
  saleDate: Date;
  customer: { name: string; phone: string; altPhone: string };
  delivery: { city: string; address: string };
  items: OrderItemDoc[];
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  deliveryChargeCollected: boolean;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  due: number;
  status: string;
  statusHistory: { status: string; at: Date }[];
  stockApplied: boolean;
  courier: { name: string; trackingId: string };
  source: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

// Typed loosely on purpose: Mongoose's generic inference exhausts the TS compiler.
function model<T>(name: string, schema: Schema<any>): Model<T> {
  return (mongoose.models[name] ?? mongoose.model(name, schema)) as unknown as Model<T>;
}

/* ---------- Settings (shop-wide) ---------- */
const settingsSchema = new Schema<any>(
  {
    _id: { type: String, default: "main" },
    passwordHash: { type: String, default: "" },
    sessionVersion: { type: Number, default: 1 },
    distributedTotal: { type: Number, default: 0 },
    lastDistributedUpTo: { type: Date, default: null },
    shopName: { type: String, default: "Meroprobha" },
    deliveryInsideDhaka: { type: Number, default: 70 },
    deliveryOutsideDhaka: { type: Number, default: 130 },
    lowStockThreshold: { type: Number, default: 2 },
  },
  { timestamps: true }
);
export const Settings = model<SettingsDoc>("Settings", settingsSchema);

/* ---------- Counter (human-friendly sequential codes) ---------- */
const counterSchema = new Schema<any>({ _id: String, seq: { type: Number, default: 0 } });
const Counter = model<{ _id: string; seq: number }>("Counter", counterSchema);

export async function nextSeq(key: string, session?: mongoose.ClientSession): Promise<number> {
  const c = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after", session });
  return c!.seq;
}

/* ---------- Category: genre (parent = null) or sub-category (parent = genre) ---------- */
const categorySchema = new Schema<any>(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true }, // lowercased name, for uniqueness
    parent: { type: Schema.Types.ObjectId, ref: "Category", default: null },
  },
  { timestamps: true }
);
categorySchema.index({ parent: 1, key: 1 }, { unique: true });
export const Category = model<CategoryDoc>("Category", categorySchema);

/* ---------- Product ---------- */
const changeSchema = new Schema<any>({ field: String, from: Schema.Types.Mixed, to: Schema.Types.Mixed }, { _id: false });
const historySchema = new Schema<any>(
  {
    at: { type: Date, default: Date.now },
    // created | edit | sale | sale_edit | cancel | reactivate | order_deleted
    type: { type: String, required: true },
    note: String,
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    qtyChange: Number,
    changes: [changeSchema],
  },
  { _id: false }
);

const productSchema = new Schema<any>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    genre: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    buyingPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, default: null, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    description: { type: String, default: "" },
    images: [{ type: Schema.Types.ObjectId }],
    archived: { type: Boolean, default: false },
    lastEditedAt: { type: Date, default: null },
    history: [historySchema],
  },
  { timestamps: true }
);
productSchema.index({ name: "text", code: "text" });
productSchema.index({ genre: 1, category: 1 });
export const Product = model<ProductDoc>("Product", productSchema);

/* ---------- Order (a sale) ---------- */
const orderItemSchema = new Schema<any>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    code: String,
    name: String,
    genre: { type: Schema.Types.ObjectId, ref: "Category" },
    genreName: String,
    category: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    categoryName: String,
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 }, // actual selling price for this sale
    unitCost: { type: Number, required: true, min: 0 }, // buying price snapshot at time of sale
  },
  { _id: false }
);

const orderSchema = new Schema<any>(
  {
    orderNo: { type: Number, required: true, unique: true },
    saleDate: { type: Date, required: true },
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      altPhone: { type: String, default: "" },
    },
    delivery: {
      city: { type: String, required: true },
      address: { type: String, default: "" },
    },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    deliveryChargeCollected: { type: Boolean, default: true },
    total: { type: Number, required: true }, // what the customer pays
    paymentMethod: { type: String, required: true },
    amountPaid: { type: Number, default: 0 },
    due: { type: Number, default: 0 },
    status: { type: String, required: true, default: "packaging" },
    statusHistory: [{ status: String, at: { type: Date, default: Date.now }, _id: false }],
    stockApplied: { type: Boolean, default: true }, // true while the items are deducted from inventory
    courier: { name: { type: String, default: "" }, trackingId: { type: String, default: "" } },
    source: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);
orderSchema.index({ saleDate: -1 });
orderSchema.index({ status: 1, saleDate: -1 });
orderSchema.index({ "customer.phone": 1 });
export const Order = model<OrderDoc>("Order", orderSchema);

/* ---------- Expenses ---------- */
export interface ExpenseCategoryDoc { _id: Id; name: string; key: string }
const expenseCategorySchema = new Schema<any>(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);
export const ExpenseCategory = model<ExpenseCategoryDoc>("ExpenseCategory", expenseCategorySchema);

export interface ExpenseDoc {
  _id: Id;
  date: Date;
  category: Id;
  categoryName: string;
  amount: number;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}
const expenseSchema = new Schema<any>(
  {
    date: { type: Date, required: true },
    category: { type: Schema.Types.ObjectId, ref: "ExpenseCategory", required: true },
    categoryName: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);
expenseSchema.index({ date: -1 });
export const Expense = model<ExpenseDoc>("Expense", expenseSchema);

/* ---------- Accounts (super admin + partner admins) ---------- */
export interface UserDoc {
  _id: Id;
  username: string;
  name: string;
  phone: string;
  role: "super" | "admin";
  passwordHash: string;
  sessionVersion: number;
  active: boolean;
  balance: number;
  totalReceived: number;
  totalWithdrawn: number;
  createdAt: Date;
  updatedAt: Date;
}
const userSchema = new Schema<any>(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    role: { type: String, enum: ["super", "admin"], default: "admin" },
    passwordHash: { type: String, required: true },
    sessionVersion: { type: Number, default: 1 },
    active: { type: Boolean, default: true },
    balance: { type: Number, default: 0 },
    totalReceived: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 },
  },
  { timestamps: true }
);
export const User = model<UserDoc>("User", userSchema);

/* ---------- Ledger: profit distributions and withdrawals ---------- */
export interface ShareDoc { user: Id; name: string; pct: number; amount: number }
export interface LedgerDoc {
  _id: Id;
  type: "distribution" | "withdrawal";
  by: Id;
  byName: string;
  note: string;
  // distribution
  upTo: Date | null;
  profitToDate: number;
  alreadyDistributed: number;
  available: number;
  shares: ShareDoc[];
  distributed: number;
  retained: number;
  // withdrawal
  user: Id | null;
  userName: string;
  amount: number;
  reversed: { at: Date; by: Id; byName: string } | null;
  createdAt: Date;
}
const ledgerSchema = new Schema<any>(
  {
    type: { type: String, enum: ["distribution", "withdrawal"], required: true },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    byName: { type: String, required: true },
    note: { type: String, default: "" },
    upTo: { type: Date, default: null },
    profitToDate: { type: Number, default: 0 },
    alreadyDistributed: { type: Number, default: 0 },
    available: { type: Number, default: 0 },
    shares: [{ _id: false, user: { type: Schema.Types.ObjectId, ref: "User" }, name: String, pct: Number, amount: Number }],
    distributed: { type: Number, default: 0 },
    retained: { type: Number, default: 0 },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    userName: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    reversed: { type: new Schema({ at: Date, by: Schema.Types.ObjectId, byName: String }, { _id: false }), default: null },
  },
  { timestamps: true }
);
ledgerSchema.index({ createdAt: -1 });
ledgerSchema.index({ "shares.user": 1 });
ledgerSchema.index({ user: 1 });
export const Ledger = model<LedgerDoc>("Ledger", ledgerSchema);
