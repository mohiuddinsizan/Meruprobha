// Shapes returned by the API, for client components.
export type Genre = { _id: string; name: string; productCount: number; categories: { _id: string; name: string; productCount: number }[] };

export type Product = {
  _id: string;
  code: string;
  name: string;
  genre: { _id: string; name: string } | null;
  category: { _id: string; name: string } | null;
  buyingPrice: number;
  sellingPrice: number | null;
  quantity: number;
  description: string;
  images: string[];
  archived: boolean;
  lastEditedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HistoryEntry = {
  at: string;
  type: string;
  note?: string;
  orderId?: string;
  qtyChange?: number;
  changes?: { field: string; from: unknown; to: unknown }[];
};

export type OrderItem = {
  product: string;
  code: string;
  name: string;
  genre: string;
  genreName: string;
  category: string | null;
  categoryName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
};

export type Order = {
  _id: string;
  orderNo: number;
  saleDate: string;
  customer: { name: string; phone: string; altPhone: string };
  delivery: { city: string; address: string };
  items: OrderItem[];
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  deliveryChargeCollected: boolean;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  due: number;
  status: string;
  statusHistory: { status: string; at: string }[];
  courier: { name: string; trackingId: string };
  source: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Settings = { shopName: string; deliveryInsideDhaka: number; deliveryOutsideDhaka: number; lowStockThreshold: number };

export type Account = {
  _id: string;
  username: string;
  name: string;
  phone: string;
  role: "super" | "admin";
  active: boolean;
  balance: number;
  totalReceived: number;
  totalWithdrawn: number;
  createdAt: string;
};

export type LedgerEntry = {
  _id: string;
  type: "distribution" | "withdrawal";
  by: string;
  byName: string;
  note: string;
  upTo: string | null;
  profitToDate: number;
  alreadyDistributed: number;
  available: number;
  shares: { user: string; name: string; pct: number; amount: number }[];
  distributed: number;
  retained: number;
  user: string | null;
  userName: string;
  amount: number;
  reversed: { at: string; by: string; byName: string } | null;
  createdAt: string;
};

export type DistributionPreview = {
  upTo: string;
  profit: { gross: number; expenses: number; net: number };
  alreadyDistributed: number;
  available: number;
  lastUpTo: string | null;
};
