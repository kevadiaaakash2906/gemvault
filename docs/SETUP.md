# GemVault setup guide (Phase 1)

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

1. Open your site address. You should see the GemVault sign-in page.
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
