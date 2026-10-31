# Vinere

Jewellery inventory, sales and seller management. Built with Next.js, Supabase, Tailwind CSS and Vercel.

## Status: your ledger is built (Phases 1 and 2 reworked)

Vinere now mirrors your Excel workbook only: **Orders**, **Trading**, **Expenses**, plus **Memos** (one buyer's bill and its payments) and **Rates**.

| Done and tested | Not built yet |
| --- | --- |
| Sign-in, password reset, Owner / Staff / Seller roles (see Roles below) | Seller portal and commissions |
| Who owes me, Profit report, summary cards, and Returns (password-protected, with refunds and stock restored) | Reports beyond Who owes me and Profit |
| Orders with every column of your sheet, Pg Wt and cost worked out the same way as your sheet |  |
| Trading with vendor, purchase price and profit/loss | Import screen (import is a one-off SQL file) |
| Memos, buyers and payments (part payments, cancelling with a reason) | |
| Expenses and Rates, CSV export in your sheet's column order | End-to-end browser tests |
| Roles enforced in the database as well as in the menus | |
| 53 app tests and 239 database checks, including simultaneous payments | |

## Roles

| Role | What they can do |
| --- | --- |
| Owner | Everything |
| Staff | See and edit everything except Team |
| Seller | See everything staff see except Rates. A seller can record the sale (Sold to, Memo, Sale price, Date sold) on an existing order, add and edit Trading, and delete empty memos and return records (with their own password). Order details and costs are entered by staff |

## Start here

Follow **docs/SETUP.md** from top to bottom. No programming is needed.

## For developers

    npm install
    cp .env.example .env.local     # then fill in the values
    npm run dev                    # http://localhost:3000
    npm run lint && npm run typecheck && npm test && npm run build
    TEST_DATABASE_URL=postgres://... ./scripts/run-rls-tests.sh   # database security tests

Folders: `src/app` pages and server actions, `src/lib` permissions, validation and Supabase helpers,
`supabase/migrations` database, `supabase/tests` security tests, `docs` guides.

## Security notes

- Only the *publishable* Supabase key is used. The secret/service-role key is never needed or stored.
- Public sign-up must be switched off in Supabase (SETUP.md, step 5). New accounts get no role and no access until an owner assigns one.
- Role changes happen only through database functions that check the caller is an owner.
