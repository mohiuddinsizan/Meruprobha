// Fills the database with dummy data for trying the app out.
// Every document it creates carries `demo: true`, so scripts/clear-demo.mjs can remove it exactly.
// Run:  node --env-file=.env.local scripts/seed-demo.mjs
import mongoose from "mongoose";

const OFFSET = 6 * 3600 * 1000; // Dhaka, UTC+6
const todayYmd = () => new Date(Date.now() + OFFSET).toISOString().slice(0, 10);
const addDays = (ymd, n) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const dayStart = (ymd) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d) - OFFSET); };
const at = (ymd, hour) => new Date(dayStart(ymd).getTime() + hour * 3600 * 1000);
const FIRST_ORDER_NO = 1150; // keep in sync with src/lib/constants.ts
const round = (n) => Math.round(n * 100) / 100;

// Deterministic random so re-runs look the same.
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const C = (n) => db.collection(n);

if (await C("products").findOne({ demo: true })) {
  console.log("Demo data is already there. Run scripts/clear-demo.mjs first to re-seed.");
  process.exit(0);
}

const now = new Date();
const today = todayYmd();
const START = addDays(today, -95); // ~3 months of history

/* ---------- Sub-categories ---------- */
const genres = new Map((await C("categories").find({ parent: null }).toArray()).map((g) => [g.name, g]));
const SUBS = {
  Bangles: ["Gold Plated", "Glass", "Oxidised"],
  Necklace: ["Choker", "Long Haar", "Bridal Set"],
  Earrings: ["Jhumka", "Studs", "Chandbali"],
  Rings: ["Adjustable", "Stone"],
};
const sub = new Map();
for (const [g, names] of Object.entries(SUBS)) {
  const genre = genres.get(g);
  if (!genre) continue;
  for (const name of names) {
    const key = name.toLowerCase();
    const existing = await C("categories").findOne({ parent: genre._id, key });
    if (existing) { sub.set(`${g}/${name}`, existing); continue; }
    const doc = { _id: new mongoose.Types.ObjectId(), name, key, parent: genre._id, demo: true, createdAt: now, updatedAt: now, __v: 0 };
    await C("categories").insertOne(doc);
    sub.set(`${g}/${name}`, doc);
  }
}

/* ---------- Products ---------- */
// [name, genre, sub-category or null, buying, selling, starting stock]
const CATALOG = [
  ["Golden Kundan Bangle Pair", "Bangles", "Gold Plated", 450, 850, 14],
  ["Antique Gold Kada", "Bangles", "Gold Plated", 620, 1150, 8],
  ["Rainbow Glass Churi Set (24 pcs)", "Bangles", "Glass", 180, 380, 25],
  ["Red Bridal Glass Churi", "Bangles", "Glass", 220, 450, 18],
  ["Oxidised Silver Bangle", "Bangles", "Oxidised", 260, 520, 12],
  ["Temple Design Choker", "Necklace", "Choker", 900, 1650, 7],
  ["Pearl Layered Choker", "Necklace", "Choker", 750, 1400, 9],
  ["Rani Haar Long Necklace", "Necklace", "Long Haar", 1300, 2400, 5],
  ["Kundan Bridal Necklace Set", "Necklace", "Bridal Set", 2800, 4900, 4],
  ["Polki Bridal Set with Tikka", "Necklace", "Bridal Set", 3400, 5800, 3],
  ["Classic Gold Jhumka", "Earrings", "Jhumka", 280, 590, 22],
  ["Oxidised Peacock Jhumka", "Earrings", "Jhumka", 240, 490, 20],
  ["American Diamond Studs", "Earrings", "Studs", 150, 350, 30],
  ["Pearl Drop Studs", "Earrings", "Studs", 120, 290, 26],
  ["Meenakari Chandbali", "Earrings", "Chandbali", 380, 790, 11],
  ["Adjustable Floral Ring", "Rings", "Adjustable", 90, 220, 35],
  ["Ruby Stone Cocktail Ring", "Rings", "Stone", 320, 690, 10],
  ["Emerald Stone Ring", "Rings", "Stone", 340, 720, 2],
  ["Charm Chain Bracelet", "Bracelets", null, 200, 420, 16],
  ["Kundan Hathphool", "Bracelets", null, 480, 950, 6],
  ["Silver Ghungroo Anklet Pair", "Anklets", null, 300, 620, 15],
  ["Beaded Payel", "Anklets", null, 140, 320, 1],
  ["Heart Locket Pendant", "Pendants", null, 210, 450, 13],
  ["Evil Eye Pendant", "Pendants", null, 160, 360, 0],
  ["Gold Nath with Chain", "Nose Pins", null, 260, 560, 9],
  ["Tiny Stone Nose Pin", "Nose Pins", null, 60, 160, 40],
];

const counter = async (key, inc) => (await C("counters").findOneAndUpdate({ _id: key }, { $inc: { seq: inc } }, { upsert: true, returnDocument: "after" })).seq;
const lastProductSeq = await counter("product", CATALOG.length);
const products = CATALOG.map(([name, g, s, buy, sell, baseQty], i) => {
  const qty = baseQty <= 2 ? baseQty + 3 : baseQty * 2 + 6;
  const genre = genres.get(g);
  const cat = s ? sub.get(`${g}/${s}`) : null;
  const created = at(addDays(START, -int(3, 10)), 11);
  return {
    _id: new mongoose.Types.ObjectId(),
    code: "P-" + String(lastProductSeq - CATALOG.length + i + 1).padStart(4, "0"),
    name, genre: genre._id, genreName: genre.name, category: cat?._id ?? null, categoryName: cat?.name ?? "",
    buyingPrice: buy, sellingPrice: sell, quantity: qty, startQty: qty,
    description: `${name} — dummy product for testing.`,
    images: [], archived: false, lastEditedAt: null,
    history: [{ at: created, type: "created", note: `Created with quantity ${qty}` }],
    createdAt: created, updatedAt: created,
  };
});
// One product with a price edit, to show edit history.
products[1].history.push({ at: at(addDays(START, 30), 15), type: "edit", note: "Edited", changes: [{ field: "sellingPrice", from: 1100, to: 1150 }] });
products[1].lastEditedAt = at(addDays(START, 30), 15);

/* ---------- Orders ---------- */
const CUSTOMERS = [
  ["Nusrat Jahan", "Dhaka", "House 12, Road 5, Dhanmondi"], ["Farzana Akter", "Dhaka", "Mirpur 10, Block C"],
  ["Sumaiya Islam", "Chattogram", "GEC Circle, Nasirabad"], ["Tania Rahman", "Gazipur", "Tongi, Station Road"],
  ["Mim Chowdhury", "Sylhet", "Zindabazar"], ["Rafiya Sultana", "Dhaka", "Uttara Sector 7"],
  ["Jannatul Ferdous", "Rajshahi", "Shaheb Bazar"], ["Ayesha Siddika", "Narayanganj", "Chashara"],
  ["Lamia Hossain", "Khulna", "Sonadanga"], ["Sadia Afrin", "Dhaka", "Bashundhara R/A, Block D"],
  ["Tasnim Ara", "Cumilla", "Kandirpar"], ["Rumana Begum", "Barishal", "Sadar Road"],
  ["Shirin Akhter", "Mymensingh", "Ganginarpar"], ["Priya Das", "Dhaka", "Mohammadpur, Tajmahal Road"],
  ["Maliha Kabir", "Bogura", "Satmatha"], ["Nadia Haque", "Rangpur", "Jahaj Company More"],
];
const phoneOf = (i) => "01" + pick(["7", "8", "9", "3", "5", "6"]) + String(10000000 + i * 7919 + int(0, 999)).slice(0, 8);
const custPhones = CUSTOMERS.map((_, i) => phoneOf(i));
const SOURCES = ["Facebook", "Facebook", "Facebook", "Instagram", "WhatsApp", "Phone call", "Walk-in", "Website"];
const COURIERS = ["Steadfast", "Pathao", "RedX", "Paperfly"];

const stock = new Map(products.map((p) => [String(p._id), p.quantity]));
const orders = [];
const lastOrderSeq = await counter("order", 0); // read
let orderSeq = lastOrderSeq;

for (let d = START; d <= today; d = addDays(d, 1)) {
  const n = d === today ? 3 : rnd() < 0.2 ? 0 : int(1, 4);
  for (let k = 0; k < n; k++) {
    const ci = int(0, CUSTOMERS.length - 1);
    const [cname, city, address] = CUSTOMERS[ci];
    const lines = [];
    for (let j = 0, m = rnd() < 0.7 ? 1 : int(2, 3); j < m; j++) {
      const p = pick(products);
      if (lines.some((l) => l.p === p)) continue;
      const qty = rnd() < 0.85 ? 1 : 2;
      if (stock.get(String(p._id)) < qty) continue;
      lines.push({ p, qty });
    }
    if (!lines.length) continue;

    const ageDays = Math.round((dayStart(today) - dayStart(d)) / 86400000);
    let status;
    if (ageDays <= 1) status = rnd() < 0.6 ? "packaging" : "out_for_delivery";
    else if (ageDays <= 4) status = pick(["out_for_delivery", "out_for_delivery", "delivered", "packaging"]);
    else status = rnd() < 0.1 ? "cancelled" : "delivered";

    const stockApplied = status !== "cancelled";
    if (stockApplied) for (const l of lines) stock.set(String(l.p._id), stock.get(String(l.p._id)) - l.qty);

    const items = lines.map(({ p, qty }) => ({
      product: p._id, code: p.code, name: p.name, genre: p.genre, genreName: p.genreName,
      category: p.category, categoryName: p.categoryName, quantity: qty,
      unitPrice: rnd() < 0.3 ? p.sellingPrice - pick([20, 50, 100]) : p.sellingPrice, // sometimes sold a bit cheaper
      unitCost: p.buyingPrice,
    }));
    const subtotal = round(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
    const discount = rnd() < 0.2 ? pick([50, 100]) : 0;
    const inDhaka = city === "Dhaka";
    const walkIn = rnd() < 0.08;
    const deliveryCharge = walkIn ? 0 : inDhaka ? 70 : 130;
    const deliveryChargeCollected = rnd() < 0.9;
    const total = round(subtotal - discount + (deliveryChargeCollected ? deliveryCharge : 0));
    const paymentMethod = walkIn ? "Cash (in hand)" : pick(["Cash on Delivery", "Cash on Delivery", "Cash on Delivery", "bKash", "Nagad"]);
    let amountPaid = 0;
    if (status === "delivered" || walkIn || paymentMethod !== "Cash on Delivery") amountPaid = total;
    else if (rnd() < 0.3) amountPaid = deliveryCharge; // advance for delivery
    if (status === "cancelled") amountPaid = 0;

    const saleDate = at(d, int(10, 21) + rnd());
    const statusHistory = [{ status: "packaging", at: saleDate }];
    if (status !== "packaging") {
      statusHistory.push({ status: "out_for_delivery", at: new Date(saleDate.getTime() + 20 * 3600 * 1000) });
      if (status === "delivered" || status === "cancelled") statusHistory.push({ status, at: new Date(saleDate.getTime() + int(2, 4) * 86400000) });
    }
    const orderNo = FIRST_ORDER_NO - 1 + ++orderSeq;
    const _id = new mongoose.Types.ObjectId();
    orders.push({
      _id, orderNo, saleDate,
      customer: { name: cname, phone: custPhones[ci], altPhone: "" },
      delivery: { city, address: walkIn ? "" : address },
      items, subtotal, discount, deliveryCharge, deliveryChargeCollected, total, paymentMethod,
      amountPaid, due: round(total - amountPaid), status, statusHistory, stockApplied,
      courier: walkIn || status === "packaging" ? { name: "", trackingId: "" } : { name: pick(COURIERS), trackingId: String(int(10000000, 99999999)) },
      source: walkIn ? "Walk-in" : pick(SOURCES),
      notes: status === "cancelled" ? "Customer did not receive the parcel" : "",
      demo: true, createdAt: saleDate, updatedAt: statusHistory.at(-1).at, __v: 0,
    });
    for (const l of lines) {
      const prod = products.find((p) => p === l.p);
      prod.history.push({ at: saleDate, type: "sale", orderId: _id, qtyChange: -l.qty, note: `Sold (Order #${orderNo}): -${l.qty}` });
      if (status === "cancelled") {
        prod.history.push({ at: statusHistory.at(-1).at, type: "cancel", orderId: _id, qtyChange: l.qty, note: `Order cancelled (Order #${orderNo}): +${l.qty}` });
      }
    }
  }
}
await C("counters").updateOne({ _id: "order" }, { $set: { seq: orderSeq } }, { upsert: true });

for (const p of products) {
  p.quantity = stock.get(String(p._id));
  delete p.genreName; delete p.categoryName; delete p.startQty;
  p.history.sort((a, b) => a.at - b.at);
  p.demo = true; p.__v = 0;
}
await C("products").insertMany(products);
await C("orders").insertMany(orders);

/* ---------- Expenses ---------- */
const ecat = new Map((await C("expensecategories").find().toArray()).map((c) => [c.name, c]));
const expenses = [];
const addExp = (ymd, name, amount, note) => {
  const c = ecat.get(name);
  if (!c) return;
  const date = at(ymd, 12);
  expenses.push({ date, category: c._id, categoryName: c.name, amount, note, demo: true, createdAt: date, updatedAt: date, __v: 0 });
};
for (let d = START; d <= today; d = addDays(d, 1)) {
  const dom = Number(d.slice(8));
  if (dom === 1) { addExp(d, "Shop Rent", 5000, "Monthly rent"); addExp(d, "Utilities & Internet", 1500, "Internet + electricity"); }
  if (dom === 5) addExp(d, "Salary", 4000, "Packing helper salary");
  if (dom % 7 === 0) addExp(d, "Advertising (Facebook/Instagram)", pick([800, 1200, 1500, 2000]), "Facebook boost");
  if (dom % 10 === 3) addExp(d, "Packaging", pick([450, 600, 750]), "Boxes and bubble wrap");
  if (rnd() < 0.2) addExp(d, "Food", pick([120, 180, 250]), "Lunch");
  if (rnd() < 0.15) addExp(d, "Transport", pick([80, 150, 300]), "Rickshaw / CNG to wholesale market");
  if (rnd() < 0.06) addExp(d, "Other", pick([200, 350, 500]), "Misc");
}
await C("expenses").insertMany(expenses);

/* ---------- One profit distribution + one withdrawal ---------- */
const users = await C("users").find({ active: { $ne: false } }).sort({ createdAt: 1 }).toArray();
const upToYmd = addDays(today.slice(0, 8) + "01", -1); // end of last month
const upTo = dayStart(upToYmd);
const end = dayStart(addDays(upToYmd, 1));
const inRange = orders.filter((o) => o.saleDate < end && o.status !== "cancelled");
const gross = inRange.reduce((t, o) => t + o.subtotal - o.discount - o.items.reduce((s, i) => s + i.quantity * i.unitCost, 0), 0);
const [realProfit] = await C("orders").aggregate([
  { $match: { saleDate: { $lt: end }, status: { $ne: "cancelled" }, demo: { $ne: true } } },
  { $group: { _id: null, n: { $sum: 1 } } },
]).toArray();
const [eAgg] = await C("expenses").aggregate([{ $match: { date: { $lt: end } } }, { $group: { _id: null, t: { $sum: "$amount" } } }]).toArray();
const settings = await C("settings").findOne({ _id: "main" });
const already = round(settings?.distributedTotal ?? 0);
const net = round(gross - (eAgg?.t ?? 0));
const available = round(net - already);

let summary = "";
if (!realProfit && already === 0 && available > 0 && users.length) {
  // Owner 40%, the rest split 45% between partners; 15% stays in the company.
  const partners = users.filter((u) => u.role !== "super");
  const owner = users.find((u) => u.role === "super");
  const pcts = [];
  if (owner) pcts.push([owner, 40]);
  for (const p of partners) pcts.push([p, round(45 / Math.max(partners.length, 1))]);
  const shares = pcts.map(([u, pct]) => ({ user: u._id, name: u.name, pct, amount: round((available * pct) / 100) }));
  const distributed = round(shares.reduce((t, s) => t + s.amount, 0));
  const by = owner ?? users[0];
  const dAt = at(addDays(upToYmd, 2), 14);
  await C("ledgers").insertOne({
    type: "distribution", by: by._id, byName: by.name, note: "Dummy distribution",
    upTo, profitToDate: net, alreadyDistributed: already, available, shares, distributed,
    retained: round(available - distributed), user: null, userName: "", amount: 0, reversed: null,
    demo: true, createdAt: dAt, updatedAt: dAt, __v: 0,
  });
  for (const s of shares) await C("users").updateOne({ _id: s.user }, { $inc: { balance: s.amount, totalReceived: s.amount } });
  await C("settings").updateOne({ _id: "main" }, { $set: { distributedTotal: round(already + distributed), lastDistributedUpTo: upTo } });
  summary = `distribution of ৳${distributed} up to ${upToYmd}`;

  const w = shares.find((s) => partners.some((p) => String(p._id) === String(s.user))) ?? shares[0];
  const wAmount = Math.floor(w.amount / 2);
  if (wAmount > 0) {
    const wAt = at(addDays(upToYmd, 5), 16);
    await C("ledgers").insertOne({
      type: "withdrawal", by: w.user, byName: w.name, note: "Dummy withdrawal", upTo: null, profitToDate: 0,
      alreadyDistributed: 0, available: 0, shares: [], distributed: 0, retained: 0,
      user: w.user, userName: w.name, amount: wAmount, reversed: null, demo: true, createdAt: wAt, updatedAt: wAt, __v: 0,
    });
    await C("users").updateOne({ _id: w.user }, { $inc: { balance: -wAmount, totalWithdrawn: wAmount } });
    summary += `, ${w.name} withdrew ৳${wAmount}`;
  }
} else {
  summary = "skipped the distribution (real profit data or earlier distributions exist)";
}

console.log(`Added ${sub.size} sub-categories, ${products.length} products, ${orders.length} orders, ${expenses.length} expenses; ${summary}.`);
await mongoose.disconnect();
