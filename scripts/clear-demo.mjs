// Removes everything scripts/seed-demo.mjs added (documents marked `demo: true`)
// and undoes the balance / company-account changes of the dummy distribution and withdrawal.
// Run:  node --env-file=.env.local scripts/clear-demo.mjs
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const C = (n) => db.collection(n);
const FIRST_ORDER_NO = 1150; // keep in sync with src/lib/constants.ts
const round = (n) => Math.round(n * 100) / 100;

// Undo money movements first, newest first.
const entries = await C("ledgers").find({ demo: true, reversed: null }).sort({ createdAt: -1 }).toArray();
let undistributed = 0;
for (const e of entries) {
  if (e.type === "withdrawal") {
    await C("users").updateOne({ _id: e.user }, { $inc: { balance: e.amount, totalWithdrawn: -e.amount } });
  } else {
    for (const s of e.shares) await C("users").updateOne({ _id: s.user }, { $inc: { balance: -s.amount, totalReceived: -s.amount } });
    undistributed += e.distributed;
  }
}
const ledgers = await C("ledgers").deleteMany({ demo: true });
if (undistributed) {
  const prev = await C("ledgers").findOne({ type: "distribution", reversed: null }, { sort: { createdAt: -1 } });
  const s = await C("settings").findOne({ _id: "main" });
  await C("settings").updateOne({ _id: "main" }, { $set: { distributedTotal: round((s?.distributedTotal ?? 0) - undistributed), lastDistributedUpTo: prev?.upTo ?? null } });
}

const orders = await C("orders").deleteMany({ demo: true });
const expenses = await C("expenses").deleteMany({ demo: true });
const products = await C("products").deleteMany({ demo: true });
// Keep sub-categories that real products now use.
const used = await C("products").distinct("category");
const cats = await C("categories").deleteMany({ demo: true, _id: { $nin: used } });

// Put code counters back so real products/orders continue from the right number.
const maxOrder = (await C("orders").find().sort({ orderNo: -1 }).limit(1).toArray())[0];
await C("counters").updateOne({ _id: "order" }, { $set: { seq: maxOrder ? maxOrder.orderNo - (FIRST_ORDER_NO - 1) : 0 } }, { upsert: true });
const codes = await C("products").find({}, { projection: { code: 1 } }).toArray();
const maxP = Math.max(0, ...codes.map((p) => Number(String(p.code).replace(/\D/g, "")) || 0));
await C("counters").updateOne({ _id: "product" }, { $set: { seq: maxP } }, { upsert: true });

console.log(`Removed ${products.deletedCount} products, ${orders.deletedCount} orders, ${expenses.deletedCount} expenses, ${ledgers.deletedCount} log entries, ${cats.deletedCount} sub-categories.`);
await mongoose.disconnect();
