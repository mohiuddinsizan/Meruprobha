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
| `MASTER_PASSWORD` | Always works for login to any account, even after its password is changed |
| `INITIAL_ADMIN_PASSWORD` | Password of the super admin (`admin`) on a brand-new database; change it from Profile afterwards |

`.env.local` is git-ignored. Never commit it.

## How the numbers work

- **Stock**: saving a sale deducts the items from inventory. Cancelling returns them; re-opening deducts again. Editing a sale adjusts by the difference. All stock changes run in a MongoDB transaction, and a sale can never take stock below zero.
- **Selling price**: each sale stores the price actually charged. The product's selling price is only a pre-fill.
- **Cost**: each sale line stores the product's buying price at the moment of the sale, so later price edits never change past profit.
- **Profit** = (products total − discount) − buying cost. Delivery charges are never included; they are reported separately (collected from customer vs. paid by shop).
- **Expenses** (food, transport, ads… categories are editable) are subtracted from profit by their date: **Net profit = Gross profit − Expenses**.
- **Reports** exclude cancelled sales and use Bangladesh time (UTC+6) for day/month/year boundaries.
- **Products** with sales can't be hard-deleted; they're archived so history stays intact. Every manual edit is logged with what changed.

## Accounts and money

- **Accounts**: everyone signs in with a username and password. The owner is the **super admin** (username `admin`; an existing install keeps its old password). Only the super admin can add, edit or switch off partner accounts and reverse log entries; partners can do everything else.
- **Company account** = net profit to date − everything distributed so far. All profit lands here first.
- **Distribute profit** (any account): pick the date to distribute up to, then a % per partner (total ≤ 100%). The available amount is taken from the company account and added to each partner's balance; any % left over stays in the company account. A later cut-off date can't be earlier than the last one. If a sale or expense in an already distributed period changes later, the difference flows into the next distribution.
- **Withdrawals** come out of a partner's own balance and can never take it below zero. The super admin can also record a withdrawal for someone else.
- **Log**: every distribution (date, %, amounts, who) and withdrawal (who, when, note) is kept and visible to everyone. Mistakes are fixed by reversing (super admin; withdrawals any time, distributions only the latest one), which keeps the entry, marked as reversed.
- Distributions and withdrawals run in MongoDB transactions with guards, so two people acting at the same time can never pay out twice or overdraw.
