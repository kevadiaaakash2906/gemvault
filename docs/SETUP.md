# Vinere setup guide (Phase 1)

You will use three websites: **GitHub** (stores the files), **Supabase** (database and logins), **Vercel** (puts the site online).
Screens change now and then. If a button has a slightly different name, look for the closest one and ask for help if stuck.

## Step 1. Upload the files to GitHub

1. On your computer, find the ZIP file `gemvault-phase1.zip`. Right-click it, choose **Extract All...**, then **Extract**.
2. Open the extracted `gemvault` folder. You should see files such as `package.json` and folders such as `src` and `supabase`.
3. In your browser open your `gemvault` repository on GitHub and click **Add file**, then **Upload files**.
4. Select everything INSIDE the extracted folder (press Ctrl+A) and drag it onto the GitHub page. Wait until the upload bar finishes.
   GitHub can take around 100 files per upload. If it complains, upload in two or three batches (for example `src` first, then the rest).
5. Scroll down and click the green **Commit changes** button.

Check: your repository page now shows `package.json`, `src`, `supabase` and `docs`, plus the hidden-looking items `.github`, `.gitignore` and `.env.example`.
Click the **Actions** tab to watch the automatic checks run. A green tick means the code and database security tests passed on GitHub's computers.

## Step 2. Create the Supabase project

1. Open https://supabase.com and click **Start your project**. Sign up (**Continue with GitHub** is easiest).
2. Create an organization if asked. Then click **New project**.
3. Name: `gemvault`. Database password: click **Generate a password**, then save it somewhere safe (not in this chat).
4. Region: choose the closest one to you (for India, **South Asia (Mumbai)** if offered). Click **Create new project** and wait a few minutes.

## Step 3. Create the database tables and security rules

1. In Supabase, click **SQL Editor** in the left menu, then **New query**.
2. On GitHub open `supabase/migrations/20261022000001_core_auth_roles.sql`, click the **Copy raw file** icon, and paste it into the Supabase editor.
3. Click **Run**. You should see "Success. No rows returned".
   Run it only once. If you run it twice you will see "already exists" errors, which are harmless.

## Step 4. Find your two project values (nothing secret)

1. In Supabase click **Project Settings** (gear icon), then **API Keys**.
2. Copy the **Project URL** (looks like `https://abcd1234.supabase.co`) and the **Publishable key** (starts with `sb_publishable_`).
3. Do NOT use the "secret" or "service_role" key anywhere.

## Step 5. Turn off public sign-up

1. Supabase, **Authentication**, then **Sign In / Providers** (or **Providers**), open **Email**.
2. Switch **Allow new users to sign up** OFF and save.
   Now only people you add yourself can have an account.

## Step 6. Create your owner login

1. Supabase, **Authentication**, **Users**, **Add user**, **Create new user**.
2. Type your email and a strong password. Tick **Auto Confirm User** if shown. Click **Create user**.
3. Go to **SQL Editor**, **New query**, paste the line below with YOUR email, and click **Run**:

       select public.bootstrap_first_owner('you@example.com');

   Success looks like "Success. 1 row returned". This works only once, and only while no owner exists.

## Step 7. Put the site online with Vercel

1. Open https://vercel.com/signup and choose **Continue with GitHub**.
2. Click **Add New...**, then **Project**, find `gemvault`, click **Import**.
3. Open **Environment Variables** and add these three (name, then value):
   - `NEXT_PUBLIC_SUPABASE_URL` : the Project URL from Step 4
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` : the Publishable key from Step 4
   - `NEXT_PUBLIC_SITE_URL` : leave a placeholder like `https://gemvault.vercel.app` for now
4. Click **Deploy**. When it finishes, copy your site address (for example `https://gemvault-abc.vercel.app`).
5. In Vercel, **Settings**, **Environment Variables**, change `NEXT_PUBLIC_SITE_URL` to your real address, then **Deployments**, the latest one, **Redeploy**.
6. In Supabase, **Authentication**, **URL Configuration**: set **Site URL** to your address and add `https://YOUR-ADDRESS/auth/callback` under **Redirect URLs**. Save.

Pricing note: Vercel's free plan is, as far as I know, for personal and non-commercial use. Check Vercel's current terms before running a business on it.

## Step 8. Test it

1. Open your site address. You should see the Vinere sign-in page.
2. Sign in with your owner email and password. You should land on the Overview page showing "Owner" and a Team link.
3. Open **Team**. To add staff or sellers: create them in Supabase (Step 6, part 1 and 2), then give each a role on the Team page.

## Password-reset emails

Supabase's built-in email sender is limited. As far as I know it only delivers to your own team's addresses and sends very few per hour.
Before staff and sellers rely on "Forgot your password?", set up a proper email provider in Supabase under **Authentication**, **Emails**, **SMTP Settings**.
Until then you can set someone's password yourself in Supabase, **Authentication**, **Users**.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| "Supabase settings are missing" | The two variables in Step 7.3 are missing or misspelled. Fix them in Vercel, then Redeploy. |
| Sign-in says email and password do not match | Check the user exists and is confirmed in Supabase, Authentication, Users. |
| After sign-in, "Waiting for access" | Step 6.3 was not run, or you signed in with a different email than the one you used. |
| Reset link goes to a wrong or localhost address | Fix `NEXT_PUBLIC_SITE_URL` and the Supabase URL settings (Step 7.5 and 7.6), then Redeploy. |
| `bootstrap_first_owner` says no user with that email | Create the user first (Step 6.1 and 6.2) and check the spelling. |
| SQL Editor says "already exists" | The migration already ran. You can ignore it. |

## Upgrading to the ledger version (Orders, Trading, Expenses, Memos)

Do these in this order.

1. **Database first.** In Supabase open **SQL Editor**, **New query**, paste the whole file
   `supabase/migrations/20261022000003_ledger.sql`, and click **Run**. Expect "Success. No rows returned".
   This removes the earlier inventory tables (they only held test entries) and creates your ledger tables.
2. **Remove the old website files on GitHub.** The new version replaces them, and old leftovers would stop the build.
   Open your repository, click the folder `src`, click the three dots at the top right, **Delete directory**, **Commit changes**.
   Do the same for the folder `tests`. Then open `supabase/tests`, click `inventory.test.sql`, click the bin icon, **Commit changes**.
3. **Upload the new files.** **Add file**, **Upload files**. Drag the folders `src`, `tests`, `supabase`, `scripts` and `docs` from the
   extracted ZIP, then the file `README.md`, then **Commit changes**. Vercel rebuilds. Wait for **Ready**.
4. **Sign in** as owner. The menu shows Overview, Orders, Trading, Memos, Expenses, Rates and Team.
5. **Set your rates.** Open **Rates** and enter today's gold rate and dollar rate.
6. **Import your workbook (once).** Read `vinere-import-report.md` first. Then paste `vinere-import.sql` into Supabase SQL Editor and Run.
   Never put that file on GitHub, because it contains your business data.

## Adding the reports (Who owes me, Profit)

1. **Database first.** In Supabase open **SQL Editor**, **New query**, paste the whole file
   `supabase/migrations/20261027000004_reports.sql`, and click **Run**. Expect "Success. No rows returned". It only adds read-only views and changes none of your data.
   Then do the same with `supabase/migrations/20261027000005_kpi.sql` (the summary cards on Orders, Trading, Expenses and the Overview).
   Then `supabase/migrations/20261027000006_returns.sql` (returns). It adds the Returns list and the return function, and makes the memo totals subtract refunds.
   Then `supabase/migrations/20261027000007_roles.sql` (the Owner / Staff / Seller rules). Run these in number order: 4, 5, 6, 7, 8, then 9.
   Then `supabase/migrations/20261027000009_order_sr_no.sql` (choose the Sr. No. when adding an order).
   Then `supabase/migrations/20261027000008_trading_deletes.sql` (sellers can edit Trading; delete memo and delete return).
2. **Upload the changed files** to GitHub (same way as before) and wait for Vercel to show **Ready**.
3. **Who owes me** and **Profit** appear in the menu for everyone who can see the ledger (owner, staff and seller).
4. If Profit says some sold pieces have "no cost on file", open **Show them**, then open each piece and enter its cost. Those pieces are left out of profit until then.

## Returns

1. Open a **sold** order or trading item. Under the form, choose **Return this piece**.
2. Type a reason and **your own login password**, then **Confirm return**. A wrong password changes nothing.
3. The sale leaves sales and profit, and the piece goes back into stock. If the buyer had already paid more than the reduced memo bill, the page tells you how much to hand back, and it is recorded as a refund.
4. **Returns** in the menu lists every return. Owner and staff can record returns; sellers cannot.
5. A sale can no longer be removed by editing the piece. It has to be a return, so there is always a record and a password check.

## Roles

| Role | What they can do |
| --- | --- |
| **Owner** | Everything |
| **Staff** | See and edit everything except **Team** (this includes costs, expenses, Rates, profit, cancelling payments and deleting) |
| **Seller** | See everything staff see except **Rates** and **Team**. A seller can record or change the sale on an existing order (Sold to, Memo, Sale price, Date sold), add and edit **Trading**, and permanently delete an empty memo or a return record with their own password. A seller opens an order from the Orders tab and fills in the Sale box |

To give someone a role, see "Adding people" above. If you later want sellers not to see costs, profit or expenses, tell me and I will change it (it is one database function and one line in the app).

## Deleting a memo or a return permanently

1. **Memo:** open the memo and scroll to the bottom, **Delete this memo permanently**. Only an **empty** memo can be deleted. If it still has pieces, return them first (open the piece, **Return this piece**). The memo, its payments and its return records go, and a full copy is kept in the audit log.
2. **Return:** open **Returns**, click the return, and use **Delete this return permanently** at the bottom. Only the record goes; the piece stays in stock. A return that refunded money can only be deleted while the memo would not be left overpaid. Otherwise delete the whole (empty) memo.
3. Both need **your own login password**.

## Sr. No. on a new order

**Add order** now starts with a **Sr. No.** box that already shows the suggested number (the last one + 1). Leave it, type another number that is free (for example one that was skipped), or clear the box to take the next number automatically. A number that is already used is refused with a message saying which order has it. An existing order's Sr. No. cannot be changed.

## Updating the data from your sheet (`vinere-import.sql`)

1. In Supabase open **SQL Editor, New query**, paste the whole file, and click **Run**.
2. It replaces the orders, trading items, expenses, buyers, memos and payments with what is in the sheet, then shows a row of totals at the end. Compare them with the sheet.
3. It **stops without changing anything** if someone has entered or changed anything inside the app (an order, a sale, a payment, an expense, a return or a deleted memo), because those would be lost. If that happens, tell us what was entered.
4. Never upload this file to GitHub: it contains your business data.

## Download Excel

1. On **Orders**, **Trading** or **Expenses**, click **Download Excel**. You get one file, `VINERELEDGER-<date>.xlsx`, with three tabs: Orders, Trading and Expenses. It opens on the tab you clicked from.
2. The layout is the same as your VINERELEDGER workbook: two empty rows on top, headers on row 3, the same columns in the same order, the same date formats, the dark Orders header with the first rows frozen, and the profit formula on Trading.
3. Payments are kept per memo in the app, so the file shows them like your sheet: the **Payment Log** is repeated on every row of the memo, while **Amount Paid** and **Balance Due** appear once per memo (on its first row), so the column totals add up correctly.
4. Trading has one extra column at the end, **memo**, because trades now belong to memos. Expenses ends with a **total** row that really adds up (the old one showed an error).
5. People only get the tabs and columns they are allowed to see.
6. **Adding this feature needs the Excel library.** Upload `package.json` too; Vercel installs it automatically when it builds.

## Money ledger (a seller sends money to a staff member)

1. **Database first.** In Supabase open **SQL Editor, New query**, paste the whole file `supabase/migrations/20261110000012_money.sql`, and click **Run**. It only adds new tables and actions; none of your data changes. Run it after your other migrations.
2. **Upload the changed files** to GitHub and wait for Vercel to show **Ready**. **Money** then appears in the menu for everyone.
3. **The seller** (for example Het) opens **Money**, chooses the staff member (for example Arpan), types the amount (and a date or note if they like), and clicks **Send for acceptance**. It shows as **Waiting**. It is **not logged anywhere** yet.
4. **The staff member** opens **Money**. The transfer is under **Waiting for you** (and the Overview shows a heads-up). Once they have really received the money they click **Accept**, and only then is it **Logged** and counted. If it did not arrive they click **Reject** and give a reason, and nothing is logged.
5. **The seller** can **Cancel** a transfer while it is still waiting (for example, a wrong amount), then send it again.
6. **The owner** sees every transfer and the totals by person. The owner can **Reverse** a logged transfer (a reason is required) to take it back out of the totals. It stays in the list as Reversed. The owner can also clear a waiting transfer that is stuck, for example if the staff member left.
7. **Privacy:** a seller only sees transfers they sent, and a staff member only sees transfers sent to them. The owner sees all. Only the person a transfer was sent to can accept it, not even the owner.
8. **More people later:** add a new seller or staff member under **Team** as usual. Every seller can send to any active staff member, and each staff member only sees what was sent to them.
9. Nothing is ever edited or deleted. Every step is saved in the audit log. Amounts are in US dollars.

