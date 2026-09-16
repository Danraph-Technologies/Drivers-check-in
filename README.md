# DanRaph Trip Report

Trip reports for DanRaph Transport drivers and management. Drivers file one report per trip from their phone after landing. The admin sees who loaded today, routes, seats and earnings, without calling anyone.

## What is inside

- Driver side: sign in with phone number, first-time PIN creation, trip report form with offline draft saving and a GPS stamp, history, receipts, change PIN.
- Admin side: dashboard with today's numbers and a call list of drivers who have not reported, trips list with filters, trip editing and voiding with an audit trail, filing on behalf of a driver, driver and bus management, admin team, weekly report, CSV export.
- Stack: Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Neon Postgres, Drizzle ORM, bcryptjs, jose sessions, Zod.

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Create a free database at [neon.tech](https://neon.tech). Choose the London (eu-west-2) region. Copy the pooled connection string.

3. Copy `.env.example` to `.env` and fill in:

   - `DATABASE_URL`: the Neon connection string
   - `AUTH_SECRET`: any random string of 32+ characters. PowerShell: run the two lines below and paste the output.

     ```powershell
     $b = [byte[]]::new(32); [Security.Cryptography.RandomNumberGenerator]::Fill($b); [Convert]::ToBase64String($b)
     ```

   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`: the first admin account.

4. Create the tables and the first admin:

   ```
   npm run db:push
   npm run db:seed
   ```

5. Run it:

   ```
   npm run dev
   ```

   Open http://localhost:3000. Sign in on the Admin tab, add your buses (PMT 4016, 4017...), then add drivers with name and phone number.

## How drivers start

1. Driver opens the site, enters their phone number (the one the admin registered).
2. The app shows their name: "Is this you?". They confirm and choose a 4 digit PIN.
3. From then on they sign in with phone number + PIN. The session lasts 30 days, so they rarely sign in again.
4. Forgotten PIN: the admin resets it from the driver's page in the admin panel.

## Deploying to Vercel

1. Push this folder to a Git repository and import it in Vercel.
2. Set the environment variables in Vercel: `DATABASE_URL`, `AUTH_SECRET` (generate a new one for production).
3. Set the Vercel function region to London (lhr1) so functions sit next to the database.
4. Run `npm run db:push` and `npm run db:seed` against the production `DATABASE_URL` once.
5. Open the site on a real Android phone over mobile data and file a test trip.

## Useful facts

- All times are stored in UTC and displayed in West Africa Time. "Today" always means today in Lagos.
- A report can never be saved twice: each submission carries a unique reference, so double taps and retries after a bad connection are safe.
- Reports are never deleted. The admin edits (with a required note) or voids (with a required reason), and every change lands in the audit trail on the trip's page.
- 5 wrong PIN attempts locks sign in for 15 minutes. Resetting the PIN clears the lock.
- The CSV export opens directly in Excel with working sums.
