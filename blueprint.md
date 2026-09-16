# DanRaph Driver Trip Report - Blueprint

DanRaph Transport runs passenger buses around Enugu, Nigeria. Drivers do not load every day, they load on their turn. This app replaces the daily phone calls the admin manager makes to find out who loaded. Each driver files one trip report per trip from their phone, after landing at the destination. The admin opens a dashboard and sees exactly who loaded today, where they went, how many seats they carried and how much money the trip and any cargo generated.

## The one sentence

Drivers report their trips from their phones after landing, and management sees the full record without calling anyone.

## How it works

1. The admin creates an account for every driver: full name, phone number and the bus they handle (PMT 4016, PMT 4017, PMT 4018 and so on).
2. The driver opens the website on their phone and enters their phone number.
3. The first time, the app shows the driver's name and asks "Is this you?". When they confirm, they choose a 4-digit PIN. That PIN becomes their sign in, together with their phone number.
4. They then file a trip report for the trip they just completed.
5. If a driver forgets their PIN, the admin resets it. The driver then signs in with their phone number and chooses a new PIN.

Drivers are in a hurry at departure, so the report is filed after landing. The form is short, works on a cheap Android phone on a slow network, and takes under a minute.

## The trip report

One report per trip. A driver can file several reports in one day.

1. Trip date. Defaults to today. Editable, because a driver who slept at the destination may file the next morning.
2. From. Typed freely, since routes change. Suggestions appear from past trips.
3. To. Same as above.
4. Seats loaded.
5. Amount per seat in Naira. The full trip amount is this times the number of seats, shown live on the form as it is typed.
6. Was there any cargo load? Yes or No. If yes, the cargo amount in Naira.
7. Departure time.
8. Arrival time. Defaults to now, since drivers usually file just after landing.

When the driver submits, the app also records the GPS location once, at that moment. The coordinates are resolved into a real place name (street, area, town) using the free OpenStreetMap Nominatim service and stored with the report. This never blocks the report. If permission is denied or location is unavailable, the report still saves and is marked as such.

## Protection against mistakes

- A report can only be submitted once, even if the driver taps save twice or retries after a dropped connection.
- The form saves as a draft on the phone while typing, so a dropped connection never loses entries.
- The admin can edit any report (a note is required) or void it with a reason. Reports are never deleted. Every change is written to an audit trail.
- Trip dates cannot be in the future and cannot be older than 14 days.

## Money figures

Version 1 records the figures only. There is no remittance tracking yet. That can be added later without changing the structure.

## Roles

### Admin (the manager)

- Dashboard with today's numbers: trips, seats, trip earnings, cargo earnings, drivers who loaded.
- The call list: active drivers who have not reported today.
- All trips, with filters by date range, driver and route.
- Edit or void any report, with an audit trail.
- File a report on behalf of a driver whose phone is dead.
- Manage drivers, buses and other admins.
- Weekly report (Monday to Sunday) with per-driver totals, a CSV export that opens in Excel, and a Download PDF button that produces a branded Drivers Activity Report (date range, per-driver table, daily earnings, full trip list, net profit) ready to send out.

### Driver

- Sign in with phone number and PIN.
- File a trip report.
- See today's reports and their full history.
- Change their own PIN.

There is no supervisor role in version 1.

## Screens

Driver side:

- Sign in (phone number, then PIN)
- Home: file trip report button, today's reports
- Trip form
- My reports (history)
- Trip receipt (read only)
- Change PIN

Admin side (separate sign-in at /admin/login):

- Dashboard
- Trips list with filters
- Trip detail with edit, void, restore and audit history
- File a report for a driver
- Drivers (add, edit, assign bus, reset PIN, activate or deactivate)
- Buses (add, edit, activate or deactivate)
- Team (other admins)
- Weekly report and CSV export

## Data model

Five tables in Postgres, UUID primary keys, timestamps stored in UTC, displayed in West Africa Time (Africa/Lagos).

- users: one row per sign in identity. Role (admin or driver), name, email and password hash for admins, active flag, failed login attempts and lock time.
- drivers: phone (unique), PIN hash (empty until the driver first signs in), assigned bus, status, failed PIN attempts and lock time. One bus belongs to exactly one driver: the app refuses to save a bus that another driver already holds, and a unique database index enforces the same rule even under a race.
- buses: label (for example PMT 4018), seat capacity, status, notes.
- trips: the core table. Driver, bus, trip date, from, to, seats loaded, amount per seat (full amount is amount times seats), cargo flag, cargo amount, fuel and feeding expenses in naira, arrival time only (departure was removed), submitted time, created by, GPS latitude, longitude and accuracy with a location status, a resolved location address (place name), void fields. A client reference (unique) protects against duplicate submissions.
- trip_audit: one row per change to a trip: created, edited, voided or restored, who did it, a required note and what changed.

Rules enforced by the database: seats between 0 and 100, amounts not negative, cargo amount required when cargo is yes, one bus per driver, trips are never hard deleted.

## Tech stack

- Next.js (App Router, TypeScript, Tailwind CSS) on Vercel
- Neon Postgres, accessed with Drizzle ORM
- Sign in: bcryptjs for PIN and password hashing, a signed JWT in an httpOnly cookie for the session (30 days)
- Zod for server side validation
- CSV export as an Excel friendly file, and a PDF activity report generator with a chosen date range
- No chart library: the weekly bars are plain server rendered elements

PIN security: 5 wrong attempts locks sign in for 15 minutes. Lock state lives in the database, so it works on serverless.

## UI rules

- Plain English, short sentences. No emojis. No decorative elements.
- Large text, large buttons, one column, one screen per action.
- Works one handed on a small Android phone over a slow network.
- All times shown in West Africa Time.

## Version 1 scope

Included: everything above.

Fuel and feeding are recorded per trip as plain expense numbers (record only, no receipts); the weekly report shows road expenses and a net figure. Cargo belongs to the driver, not the company: cargo amounts are recorded for reference, but cargo is excluded from every net figure, and each net figure carries a note saying so. Net profit (trip earnings minus fuel and feeding, cargo excluded) appears on the dashboard, in the trip detail modal, on the trip detail page, in the CSV export, and in the PDF report. Period filters (Today, Yesterday, This week, This month, This year) drive the admin dashboard, the admin trips list, and the driver home page, and each of them also has an always-visible From/To calendar picker for any custom date range; the weekly report page has the same From/To picker (From to To replaces the old week picker). Every record list in the app (admin dashboard, admin trips list, driver home, driver history, drivers, buses, admin team, driver detail reports, activity report per-driver table) is paginated with links that keep the active filters, so no page grows unbounded as records pile up. Clicking any trip row on the admin dashboard or trips list opens a detail modal with the trip summary and the GPS location stamp, now showing the resolved place name (for example Trans-Ekulu Extension, Enugu East, Enugu) above the raw coordinates. Every form submit button disables itself with a spinner while pending, so double taps never send two requests.

Explicitly deferred: offline mode with a submission queue, SMS or WhatsApp reminders, remittance tracking, turn roster management, PDF export, live tracking, driver self registration, QR code sign in, fuel receipts, photos, payroll, notifications.

## Hosting

- Vercel free tier, function region London (lhr1).
- Neon Postgres free tier, project region London (eu-west-2) for low latency to Nigeria.
- The weekly CSV export serves as the record backup.

## Build order

1. Project scaffold, database schema, first admin seed
2. Sign in for both roles, sessions, lockout
3. Driver side: home, trip form, history, receipt, change PIN
4. Admin side: dashboard, trips list, trip detail with edit and void, manual entry
5. Admin management: drivers, buses, team
6. Weekly report and CSV export
7. Polish and deploy

## Deployment steps

1. Create a Neon project in the London region and copy the pooled connection string.
2. Put DATABASE_URL and AUTH_SECRET into Vercel environment variables.
3. Push the schema and seed the first admin.
4. Connect the Git repository to Vercel and deploy.
5. Smoke test on a real Android phone over mobile data, then have drivers add the site to their home screen.

## Brand

- Logo: `public/logo.png` (wordmark on transparent), `public/logo-white.png` (white variant for dark panels). Regenerate with `node scripts/extract-logo.mjs` + `node scripts/extract-icon.mjs`.
- Icons (all the red glyph on navy, from the same script): `src/app/favicon.ico` (16/32/48 multi-size, replaces the Next.js default), `src/app/icon.png` (192, file-convention favicon), `src/app/apple-icon.png` (180, iOS home screen), `public/icon-192.png` / `public/icon-512.png` (PWA manifest). `src/app/icon.png` owns the `/icon.png` route, so public copies must never use that name (conflict 500).
- Palette is sampled from the logo pixels: blue `#044dae` (primary, `--color-brand-*`), red `#f80d0d` (accent, `--color-accent-*`), near-black `#181516` (the dark panels). Theme color is the blue.
