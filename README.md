# Meroprobha Admin

Business tracking dashboard for the Meroprobha jewellery shop: inventory, sales, delivery status and profit reports.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS, MongoDB (Mongoose) and Recharts.

## Run

```bash
npm install
npm run dev          # development, http://localhost:3000
npm run build && npm start   # production
```

## Configuration (`.env.local`)

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string (database `meroprobha`) |
| `AUTH_SECRET` | Long random string used to sign login sessions |
| `MASTER_PASSWORD` | Always works for login, even after the admin password is changed |
| `INITIAL_ADMIN_PASSWORD` | Admin password used on first run only; change it from Profile afterwards |

`.env.local` is git-ignored. Never commit it.

## How the numbers work

- **Stock**: saving a sale deducts the items from inventory. Cancelling returns them; re-opening deducts again. Editing a sale adjusts by the difference. All stock changes run in a MongoDB transaction, and a sale can never take stock below zero.
- **Selling price**: each sale stores the price actually charged. The product's selling price is only a pre-fill.
- **Cost**: each sale line stores the product's buying price at the moment of the sale, so later price edits never change past profit.
- **Profit** = (products total − discount) − buying cost. Delivery charges are never included; they are reported separately (collected from customer vs. paid by shop).
- **Expenses** (food, transport, ads… categories are editable) are subtracted from profit by their date: **Net profit = Gross profit − Expenses**.
- **Reports** exclude cancelled sales and use Bangladesh time (UTC+6) for day/month/year boundaries.
- **Products** with sales can't be hard-deleted; they're archived so history stays intact. Every manual edit is logged with what changed.
