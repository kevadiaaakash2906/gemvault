# GemVault

Jewellery inventory, sales and seller management. Built with Next.js, Supabase, Tailwind CSS and Vercel.

## Status: Phases 1 and 2 of 6

| Done and tested | Not built yet |
| --- | --- |
| Sign-in, sign-out, password reset, Owner / Staff / Seller roles | Physical stock counts and discrepancy reports |
| Products with stones, certificates, photographs, barcodes | CSV import (export is done) |
| Owner-only purchase costs (separate protected table) | Supplier link and purchase reference (Phase 3) |
| Stock ledger: opening stock, transfers, owner corrections, locations | Reservations (come with sales and sellers) |
| Overselling protection, double-click protection, unchangeable history | Purchases, sales, invoices, returns (Phase 3) |
| Search, sort, filter, pages, low-stock warnings, archive, CSV export | Seller portal and commissions (Phase 4) |
| 22 app tests and 81 database security and stock checks | Dashboards, reports, notifications (Phase 5); end-to-end tests, backups guide (Phase 6) |

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
