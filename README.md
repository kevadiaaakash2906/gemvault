# GemVault

Jewellery inventory, sales and seller management. Built with Next.js, Supabase, Tailwind CSS and Vercel.

## Status: Phase 1 of 6

| Done and tested | Not built yet |
| --- | --- |
| Email/password sign-in, sign-out, password reset | Inventory, stones, photos, certificates (Phase 2) |
| Owner / Staff / Seller roles enforced in the database | Purchases, sales, invoices, payments, returns (Phase 3) |
| Safe first-owner setup, role changes by owner only | Seller portal and commissions (Phase 4) |
| Team page, audit log, business settings table | Dashboards, reports, exports (Phase 5) |
| Automated tests (app rules + 36 database security checks) | End-to-end tests, backups guide (Phase 6) |

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
