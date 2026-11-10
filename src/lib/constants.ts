export const DISTRICTS: { division: string; districts: string[] }[] = [
  { division: "Dhaka", districts: ["Dhaka", "Faridpur", "Gazipur", "Gopalganj", "Kishoreganj", "Madaripur", "Manikganj", "Munshiganj", "Narayanganj", "Narsingdi", "Rajbari", "Shariatpur", "Tangail"] },
  { division: "Chattogram", districts: ["Bandarban", "Brahmanbaria", "Chandpur", "Chattogram", "Cox's Bazar", "Cumilla", "Feni", "Khagrachhari", "Lakshmipur", "Noakhali", "Rangamati"] },
  { division: "Rajshahi", districts: ["Bogura", "Chapainawabganj", "Joypurhat", "Naogaon", "Natore", "Pabna", "Rajshahi", "Sirajganj"] },
  { division: "Khulna", districts: ["Bagerhat", "Chuadanga", "Jashore", "Jhenaidah", "Khulna", "Kushtia", "Magura", "Meherpur", "Narail", "Satkhira"] },
  { division: "Barishal", districts: ["Barguna", "Barishal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur"] },
  { division: "Sylhet", districts: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"] },
  { division: "Rangpur", districts: ["Dinajpur", "Gaibandha", "Kurigram", "Lalmonirhat", "Nilphamari", "Panchagarh", "Rangpur", "Thakurgaon"] },
  { division: "Mymensingh", districts: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"] },
];
export const ALL_DISTRICTS = DISTRICTS.flatMap((d) => d.districts);

export const ORDER_STATUSES = ["packaging", "out_for_delivery", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const STATUS_LABEL: Record<OrderStatus, string> = {
  packaging: "Packaging done",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const PAYMENT_METHODS = ["Cash on Delivery", "bKash", "Nagad", "Rocket", "Bank Transfer", "Card", "Cash (in hand)"] as const;
export const ORDER_SOURCES = ["Facebook", "Instagram", "WhatsApp", "Website", "Phone call", "Walk-in", "Other"] as const;
export const COURIERS = ["Steadfast", "Pathao", "RedX", "Paperfly", "Sundarban", "eCourier", "Own delivery", "Other"] as const;

export const DEFAULT_EXPENSE_CATEGORIES = ["Food", "Transport", "Advertising (Facebook/Instagram)", "Packaging", "Courier & Delivery", "Shop Rent", "Utilities & Internet", "Salary", "Other"];

export const DEFAULT_GENRES = ["Bangles", "Necklace", "Earrings", "Rings", "Bracelets", "Anklets", "Pendants", "Nose Pins"];
