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

export type Partner = {
  _id: string;
  name: string;
  sharePct: number;
  phone: string;
  note: string;
  shareHistory: { at: string; from: number; to: number }[];
  createdAt: string;
};
