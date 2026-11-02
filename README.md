# Vendor Atlas

A private web app for searching, comparing and maintaining a vendor directory
that used to live in an Excel sheet. Type one word ("construction", "catering",
"valves") and the page becomes a briefing on it: how many vendors, what they
offer, who covers the most of it, which offerings only one or two vendors
provide, and the full list with contact details. Pick two to four vendors and
compare them side by side: what they share, where each goes further, and
what one could add to match another. Works on a phone or a laptop.

Stack: Next.js 16 (App Router), Postgres (via `pg`), Tailwind 4. No other
services. Sign-in is built in (scrypt passwords, database sessions).

## Run it locally

```bash
# 1. A Postgres to talk to (any Postgres 14+ works)
docker run -d --name vendor-atlas-pg -e POSTGRES_PASSWORD=atlas -e POSTGRES_DB=atlas -p 5544:5432 postgres:16-alpine

# 2. Settings
cp .env.example .env.local
#    DATABASE_URL=postgres://postgres:atlas@localhost:5544/atlas

# 3. Tables, an admin account, and some data
npm install
npm run db:migrate
npm run user:create -- you@example.com admin "Your Name"   # prompts for a password
npm run db:seed -- Book2.xlsx                              # or use Upload data in the top bar

npm run dev   # http://localhost:3000
```

## Run it on the client's PC

Two set-ups, same install:

- **This computer only.** Steps 1 to 4 below. The app listens on
  `127.0.0.1` only, so no other device on the network or the internet can
  open it.
- **Reachable from anywhere.** Add step 5: a tunnel on a PC that stays on.
  The tunnel talks to the app inside Docker, so nothing is opened on the
  router and the app port stays private to the PC.

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
   (Windows or Mac) or Docker Engine (Linux). Set it to start with the PC.
2. Copy this folder onto the PC. Copy `.env.docker.example` to `.env` and
   fill in a database password and the first administrator's email and
   password. (That account is created on the first start only; afterwards
   add people from Manage ▸ Who can sign in.)
3. In a terminal in the folder:
   ```bash
   docker compose up -d --build
   ```
   After a minute the app is on http://localhost:3000, on that computer
   only.
4. Sign in, choose Upload data in the top bar and drop in the spreadsheets.
5. Reach it from outside. Two choices:
   - **A fixed address of your own** (recommended). Make a free Cloudflare
     account, add a domain to it, and in Zero Trust ▸ Networks ▸ Tunnels
     create a tunnel with a public hostname (say `vendors.example.com`)
     pointing at `http://app:3000`. Put the tunnel's token in `.env` as
     `TUNNEL_TOKEN`, then:
     ```bash
     docker compose --profile tunnel up -d
     ```
     The address is HTTPS, stays the same forever, and works on any phone.
     In Zero Trust ▸ Access you can also require a one-time code by email
     before the sign-in page even appears.
   - **A free random address, no account or domain.** Put the emails
     allowed in at all in `.env` as `ALLOWED_EMAILS` (comma-separated), then
     run `docker compose --profile quick up -d`. Visitors get a one-time code
     by email from Cloudflare before the sign-in page appears. That
     email lock is a new Cloudflare feature; if its code step sends people
     to a Cloudflare staff login instead of the app, empty `ALLOWED_EMAILS`
     and the address leads straight to the app's own sign-in. Double-click
     `Show web address.bat` (or run
     `docker compose --profile quick logs quick`) for the address. It
     changes whenever the PC or Docker restarts, and Cloudflare offers these
     tunnels without an uptime promise, so after a restart send him the new
     one. A fixed address needs the option above.

Day to day: Docker Desktop starts the containers again after a reboot
(`restart: unless-stopped`), `docker compose logs -f app` shows what the app
is doing, and `docker compose up -d --build` applies a new version of this
folder. Migrations run automatically at start.

**On Windows:** Docker Desktop needs WSL 2 and virtualisation turned on (its
installer checks both). In Docker Desktop ▸ Settings ▸ General, tick "Start
Docker Desktop when you sign in". Docker Desktop runs inside the signed-in
user's session, so a PC that should serve the app day and night needs sleep
set to Never, and should sign that user in again after a restart (Windows
Update). The commands work the same in PowerShell; use
`Copy-Item .env.docker.example .env` and `notepad .env` for step 2.

**Backups.** The `backup` service writes the whole database to
`backups/vendor-atlas-YYYY-MM-DD.sql.gz` next to this file once a day and
keeps 30 days. Copy that folder somewhere else now and then (OneDrive, a USB
drive). To restore one into the running app:

```bash
docker compose stop app
gunzip -c backups/vendor-atlas-2026-11-02.sql.gz | docker compose exec -T db psql -U atlas -d atlas
docker compose start app
```

(On Windows without `gunzip`, unzip the file first with 7-Zip, then
`Get-Content vendor-atlas-2026-11-02.sql | docker compose exec -T db psql -U atlas -d atlas`.)

## Deploy to a host instead (Render + Supabase)

1. **Database.** Create a Supabase project in the Singapore region. Under
   Connect, copy the *Session pooler* connection string (port 5432).
   Render Postgres works too; use its *Internal Database URL*.
2. **App.** Push this repo to GitHub. In Render choose New ▸ Blueprint and pick
   the repo; `render.yaml` sets everything up. When asked, paste the
   connection string as `DATABASE_URL`. Migrations run at every start.
3. **First admin.** From your machine, against the live database:
   ```bash
   DATABASE_URL='postgres://…' npm run user:create -- owner@company.ae admin "Owner Name"
   ```
4. **Data.** Sign in, choose Upload data, and drop in the spreadsheets. A
   10,000-row file previews in about a second and imports in about three.

Rename the product with `NEXT_PUBLIC_APP_NAME` (it's inlined at build time, so
redeploy after changing it). Use a custom domain from Render's settings.

## What happens to the spreadsheet

Every row goes through `src/lib/normalize.ts`, whether it comes from an
import, the add/edit form or the seed script:

- **Area of business** is split into separate activities. The source joins
  them with commas, dashes, semicolons, or nothing at all ("TradingWires");
  lists like "Bolts, Screws, Nuts … Manufacturing" are kept whole.
- **Sectors** (20 of them, in `src/lib/sectors.ts`) are assigned from the
  name and activities. Searching a sector's name (`construction`, `IT`,
  `catering`) also returns everyone in that sector.
- **Emirate** is read, in order, from the address (including Arabic and
  well-known Abu Dhabi streets), a branch in the company name ("… - Abu
  Dhabi"), and the landline area code (02 Abu Dhabi, 04 Dubai, 06 Sharjah,
  07 Ras Al Khaimah, 09 Fujairah). Set by hand, it's never overwritten.
- **Duplicates.** Import matches existing vendors by name, ignoring case,
  punctuation and "L.L.C"/"LLC" spellings. Legal suffixes still count, so
  sister companies like "… FZCO" and "… LLC" stay separate. Blank cells in
  an import never erase stored data.
- **Two list shapes, worked out per sheet.** One row per company with a cell
  listing everything it offers (the original vendor sheet), or one row per
  company and offering, the company repeating on each row (an
  approved-contractor list: Contractor Name, Work Group Number/Description,
  Associate name/Country). Each offering's code and the associated companies
  are kept, shown on the vendor, and searchable ("110010", "Schneider"). The
  upload page shows how each sheet was read and lets you switch it.
- **Names cut short.** When a list stops many names at the same length (35
  characters in the contractor list), a cut name joins the one vendor whose
  full name starts the same way, ignoring spaces ("…LIMITED-ABUDH" finds
  "… Limited - Abu Dhabi"); a later file with the full name completes a
  vendor stored under a cut one. Ambiguous cases are left alone.
- **Offerings are edited one per line**, and the Excel download writes them
  the same way, so a download can be edited and uploaded again without
  changing anything it didn't mean to.
- **Several files at once.** Upload data takes many .xlsx/.xls/.csv files,
  and every sheet in a workbook that has a company-name column. They are
  previewed and saved as one import, so a company listed in two files becomes
  one vendor. Each sheet's columns can be re-pointed or the sheet left out.
- **Offerings only grow on import.** A vendor already listed keeps every
  offering it has and gains new ones from the file, so a second spreadsheet
  adds to the first instead of overwriting it. Remove an offering with Edit.
- The stray `235` the old system appended to addresses is removed.

The original text is kept, and exports use the original columns, so nothing
is lost on a round trip. After editing the sector rules or the parser, run
`npm run db:reclassify` to apply them to existing vendors.

## Features worth knowing

- **Search as you type.** Results replace the home page under the search box
  about a third of a second after the last keystroke, with no Enter needed.
  The list comes first, with a column beside it: at a glance, who covers the
  most, other sectors, and thin supply. "Narrow to" chips filter the list by
  an offering in one tap.
- **Header:** Search, Compare and (for administrators) Upload data. Manage is
  in the account menu.

- **Compare** (button on every vendor): pick up to four and open Compare.
  Overlap is a Jaccard index over offerings, each weighted by how rare it is
  in the directory, so a shared niche service counts more than "Importing".
  "Could add" lists offerings a compared vendor has that a fair share of this
  vendor's own peer group (its main sector) also offers.
- **Position in the market** (on every vendor): breadth against its peer
  group, offerings almost nobody else has, offerings common among peers that
  it lacks, and its closest competitors.
- **Additional notes** (Edit on any vendor, or "Add a note"): free text kept
  per vendor, searchable, included in exports as AdditionalNotes and read back
  from a Notes/Remarks/Comments column on upload.
- **Hide contacts** (eye icon, top bar): blurs every email and phone number,
  hides notes and Export, for showing the screen in meetings. Remembered per
  device.
- **Shortcuts:** `/` or `Ctrl/⌘ K` jumps to search from anywhere.
- **Light only, by design.** It's shown on projectors and phones in bright
  rooms; one carefully set palette beats two half-set ones.
- **Shareable links:** every search, filter and open vendor is in the URL.
- **Roles:** administrators can import, add, edit and delete; view-only
  accounts can search and export. Manage ▸ Who can sign in.
- **Data gaps:** Manage lists vendors with no email, phone or emirate.
- **Change log:** every import, edit and deletion, with who and when.
- **Add to home screen** on a phone opens it full-screen like an app.

## Security notes

- Sessions are random tokens; only their SHA-256 is stored. 30-day expiry.
- Sign-in is throttled to 8 failures per email and IP per 15 minutes
  (in memory; resets on restart).
- All SQL is parameterised. Every API route checks the session; writes also
  check the admin role.
- If the database is a Supabase project, RLS is enabled with no policies,
  so its public REST API can't read these tables. The app connects as the
  owner over `DATABASE_URL` and never exposes that string to the browser.
- Spreadsheets are git-ignored so client data doesn't end up in the repo.

## Scripts

| Command | What it does |
|---|---|
| `npm run db:migrate` | Apply new files in `db/migrations` (the server also does this at start-up) |
| `npm run user:create -- <email> [admin\|viewer] ["Name"]` | Create an account, or reset its password |
| `npm run db:seed -- <file> [merge\|replace]` | Import a spreadsheet from the command line |
| `npm run db:reclassify` | Re-run parsing, sectors and emirates over every vendor |
