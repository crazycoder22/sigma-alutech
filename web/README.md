# Sigma Alutech — Dynamic Website (Next.js)

The dynamic replacement for the [legacy static site](../docs/legacy-static-site.md)
in the repository root.
Product catalog and project portfolio live in **Postgres**; images upload to
**Vercel Blob** (production) or `public/uploads/` (local dev); a custom
**admin panel** at `/admin` manages everything with email + password login.
The admin also runs **payroll**: a monthly salary sheet goes in, payslip PDFs
come out, and each one is delivered to the employee over WhatsApp.

The repository-level overview and deployment architecture live in the
[root README](../README.md); this file is the app's own detail.

**Live:** https://sigma-alutech.vercel.app · admin at `/admin`
**Public domain:** `sigmaalutech.in` is mid-cutover and currently serves
nothing — see [Domain cutover](#domain-cutover-in-progress).

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2 (App Router, TypeScript, Turbopack) |
| Runtime | Node 24.x on Vercel serverless functions |
| Database | Neon Postgres (production) · Docker Postgres (local/CI) |
| ORM | Drizzle + drizzle-kit |
| Image storage | Vercel Blob, with a local-filesystem driver for dev |
| Auth | Email + password (bcrypt), signed HttpOnly session cookie (jose) |
| Validation | Zod (shared schemas for API input) |
| Payslips | ExcelJS (sheet import) · pdf-lib (PDF) · JSZip (bulk download) |
| Messaging | WhatsApp Business Cloud API, with a simulation provider by default |
| Tests | Vitest (unit + integration vs real Postgres) · Playwright (e2e) |
| CI | GitHub Actions on every push and PR to `main` |

---

# Deployment architecture

## Topology

```mermaid
flowchart TB
  visitor([Visitor])
  owner([Admin · office])
  staff([Employee])

  subgraph vercel["Vercel · project sigma-alutech · root directory web/"]
    edge["Edge network<br/>static assets, JS/CSS bundles"]
    fn["Next.js server<br/>public pages · /admin · /api · payroll"]
    edge --> fn
  end

  visitor --> edge
  owner --> fn

  fn -->|"SQL over TLS · pooled"| neon[("Neon Postgres · ap-southeast-1<br/>catalog · projects · admins · payroll")]
  fn -->|"put / del · server-side token"| blob["Vercel Blob · sigma-alutech-blob<br/>photography · payslip PDFs"]
  visitor -.->|"public URLs, served direct"| blob
  fn -. "not connected yet" .-> wa["WhatsApp Business Cloud API"]
  wa -. "payslip PDF" .-> staff

  legacy["GitHub Pages · legacy static site"]
  visitor -->|"sigmaalutech.in"| legacy
```

Every public page is server-rendered per request (`dynamic = 'force-dynamic'`)
so catalog edits appear immediately without a rebuild. Uploaded images are
served **directly from the Blob host** to the browser, not proxied through the
app.

Two dashed paths are built but carry no traffic yet:

- **WhatsApp** — the provider is selected by `WHATSAPP_PROVIDER`. Until it is
  `meta`, sends are simulated: validated and recorded per line, delivered to
  nobody. See [Payroll and payslips](#payroll-and-payslips).
- **The domain** — `sigmaalutech.in` still resolves to the legacy GitHub Pages
  site in the repo root. The Next.js app is only on its Vercel URL. See
  [Domain cutover](#domain-cutover-in-progress).

## Environments

| | Production | Preview | Local |
|---|---|---|---|
| Host | Vercel (`sigma-alutech.vercel.app`) | Vercel per-branch/PR URL | `next dev` on :3000 |
| Database | Neon `neondb` | Neon `neondb` (**same DB**) | Docker `sigma` on :55432 |
| Images | Vercel Blob | Vercel Blob (same store) | `public/uploads/` |
| Trigger | push to `main`, or `vercel deploy --prod` | any other push | manual |

> **Preview deployments share the production database and blob store.** A
> preview build can therefore write real content. Until that is separated,
> treat previews as production for anything that mutates data.

## Managed services

**Vercel** — project `sigma-alutech` in team *Lakshman's projects*.
Root Directory is **`web`** (the repo also contains the legacy static site at
its root), framework preset `nextjs`, Node `24.x`.

**Neon Postgres** — `ep-twilight-sea-azrzayre-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb`,
Singapore region, accessed through the **pooled** endpoint with `sslmode=require`.
Holds `categories`, `products`, `project_categories`, `projects`, `admins`,
`employees`, `payroll_runs`, `payroll_lines`.
The connection pool is capped at 1 per invocation in production
(`src/db/index.ts`) because serverless functions are short-lived.

**Vercel Blob** — store `sigma-alutech-blob`, public host
`atzbxwqwz4wwfm9t.public.blob.vercel-storage.com`. Objects are written with
`access: 'public'` and unguessable suffixed keys under `uploads/<folder>/`.
Public means *readable by URL*; writing and deleting require the server-side
token, which never reaches the browser.

## Environment variables

Set in Vercel → Settings → Environment Variables (Production + Preview):

| Name | Source | Purpose |
|---|---|---|
| `DATABASE_URL` | Neon connection string | All database access |
| `BLOB_READ_WRITE_TOKEN` | created by connecting the Blob store | Image upload/delete. **Absent ⇒ the app falls back to the filesystem and uploads fail on Vercel** |
| `SESSION_SECRET` | `openssl rand -hex 32` | Signs the admin session cookie. Rotating it logs every admin out |
| `WHATSAPP_PROVIDER` | `mock` (default) or `meta` | **While this is not `meta`, payslip delivery is simulated — nothing reaches an employee** |
| `WHATSAPP_TOKEN` | Meta app → WhatsApp → API access token | Authenticates the send |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta → WhatsApp → API setup | The business number messages are sent from |
| `WHATSAPP_TEMPLATE` | approved template name (default `payslip_notification`) | Business-initiated messages must use an approved template |

`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` are **not** deployed — they are only
read by the local seed script.

A leftover variable named `test` exists in the project from initial setup and
can be deleted; nothing reads it.

## Deploy pipeline

```
push to main ──┬──▶ GitHub Actions ── legacy Vitest
               │                    └ web: schema push → JSON migrate → seed →
               │                         Vitest (60) → Playwright (47)
               └──▶ Vercel ── npm ci → next build → promote to production
```

The two run **independently** — Vercel does not wait for CI, so a red build can
still deploy. Check the Actions tab after pushing, or deploy deliberately with
`vercel deploy --prod` once CI is green.

CI provisions its own throwaway Postgres service container, so it never touches
Neon.

> **The Vercel git integration has been observed to miss a push.** On
> 2026-07-27 two commits deployed within a minute and the next produced no
> build at all. A skipped deploy looks exactly like a successful one from
> outside, so after pushing confirm with `vercel ls sigma-alutech` — and if
> nothing new is listed, ship it yourself with `vercel deploy --prod`.

## Schema and content changes

Migrations are **not** run during the Vercel build. Apply schema changes from a
workstation, before deploying code that depends on them:

```bash
cd web
DATABASE_URL='<neon-connection-string>' npm run db:push
```

Other one-off scripts, same pattern:

| Command | What it does |
|---|---|
| `npm run db:push` | Sync `src/db/schema.ts` to the database |
| `npm run db:migrate-json` | Re-import `../data/*.json` (idempotent, matches on slug) |
| `npm run db:seed-admin` | Create an admin, or reset an existing one's password |
| `npm run db:seed-payroll` | Add eight **invented** demo employees (skips names already present) |

To add or reset an admin login:

```bash
cd web
DATABASE_URL='<neon-connection-string>' \
SEED_ADMIN_EMAIL='someone@example.com' \
SEED_ADMIN_PASSWORD='<strong password>' \
npm run db:seed-admin
```

## Payroll and payslips

`/admin/employees` keeps the staff register (name, WhatsApp number, monthly
gross, PF, bus pass). `/admin/payroll` runs a month:

1. **Start the month** — pick a pay month; one run per month.
2. **Upload the salary sheet** — the office `.xls`/`.xlsx` is parsed and matched
   to employees by name. Rows with no matching employee, or an employee with no
   phone number, are listed rather than silently dropped.
3. **Review** — an editable grid; every figure recalculates live as you type,
   with running totals. Nothing is committed until *Save draft*.
4. **Generate** — one A4 payslip PDF per person, stored in Blob. *Download all*
   zips the lot, and is rendered on the fly so it works before generating.
5. **Send** — the PDF goes to each employee's WhatsApp number. People without a
   number are skipped with the reason recorded against their line.

The arithmetic mirrors the office spreadsheet exactly, including the 8.5-hour
day used to price overtime, and was reconciled against a real month's sheet for
all 38 people before being committed (that sheet is **not** in this repo; the
committed fixture is invented data).

Money is stored as **integer paise** throughout — no floats — so totals cannot
drift. Each payslip line **snapshots** the employee's name, phone and gross at
generation time, so editing or deleting someone later never rewrites a payslip
that has already been issued.

### Delivery is simulated until WhatsApp is connected

`WHATSAPP_PROVIDER` defaults to `mock`. The mock validates numbers and message
bodies exactly like the live provider and records per-line delivery status, but
contacts nobody, and the admin screen says so before you press Send. Going live
needs, on Meta's side: a verified WhatsApp Business account, a business phone
number (a personal WhatsApp number cannot be automated), and an **approved
message template** — business-initiated messages cannot be free text. Then set
the four `WHATSAPP_*` variables in Vercel.

Sending is one click today. A scheduled 6 PM run on salary day is not built yet.

## Domain cutover (in progress)

**As of 2026-07-27 `sigmaalutech.in` serves nothing.** Its DNS still points at
GitHub Pages, but the Pages site has no custom domain configured against it
(`gh api repos/crazycoder22/sigma-alutech/pages` reports `"cname": null`), so
the name returns GitHub's *Site not found* page over both http and https. The
legacy site is only reachable at `crazycoder22.github.io/sigma-alutech/`.

Nothing is therefore lost by pointing the domain at Vercel — there is no
working site to take down.

**Done:** `sigmaalutech.in` and `www.sigmaalutech.in` are attached to the Vercel
project.

**Outstanding — at the registrar (GoDaddy, nameservers `ns61/ns62.domaincontrol.com`):**

| Action | Type | Host | Value |
|---|---|---|---|
| delete | A | `@` | `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` (GitHub Pages) |
| delete | CNAME | `www` | `crazycoder22.github.io` |
| add | A | `@` | `216.198.79.1` |
| add | A | `@` | `64.29.17.1` |
| add | CNAME | `www` | `fe7c7c8b4208ce95.vercel-dns-017.com` |

The zone holds no MX or TXT records, so no email or domain verification breaks.
Vercel issues the certificate automatically once the records resolve; the
current TTL is 10 minutes.

Switching the nameservers to `ns1/ns2.vercel-dns.com` instead would also work,
and is safe here for the same reason — but it hands all future DNS for the
domain to Vercel, so the records above are the smaller change.

**Then, once traffic is confirmed on Vercel:**

1. Delete the root `CNAME` file and disable GitHub Pages, so the two cannot
   diverge.
2. Optionally remove the legacy site itself (root `index.html`, `css/`, `js/`,
   `data/`, `admin/`) — the app supersedes all of it.

Check progress with:

```bash
dig +short sigmaalutech.in A
cd web && vercel domains inspect sigmaalutech.in
```

## Runbook

```bash
# Deploy the current working tree to production
cd web && vercel deploy --prod

# What is live, and its build status
vercel ls sigma-alutech

# Runtime logs for a deployment (server errors, DB failures)
vercel logs <deployment-url>

# Roll back: promote a previous deployment
vercel promote <older-deployment-url>

# Pull production env vars into a local file (gitignored)
vercel env pull .env.production.local
```

**After changing any environment variable, redeploy** — running deployments keep
the values they were built with.

## Gotchas worth knowing

These all cost time during the initial deployment:

- **Root Directory must be `web`.** With the default (`.`), Vercel deploys the
  legacy static site instead and every `/api/*` route 404s.
- **The Blob store must be connected with the default env var name.** A custom
  name means `@vercel/blob` finds no token, the app falls back to the filesystem
  driver, and uploads fail with `EROFS: read-only file system`.
- **`DATABASE_URL` must point at Neon, not localhost.** The symptom is
  `ECONNREFUSED 127.0.0.1:55432` in the function logs.
- **Neon needs the pooled endpoint and TLS.** `src/db/index.ts` enables
  `ssl: 'require'` for any non-localhost host.

---

## Local development

```bash
# 1. Postgres (once)
docker run -d --name sigma-pg -e POSTGRES_PASSWORD=sigma -e POSTGRES_USER=sigma \
  -e POSTGRES_DB=sigma -p 55432:5432 postgres:16-alpine
docker exec sigma-pg psql -U sigma -c "CREATE DATABASE sigma_test;"

# 2. Install & set up schema + content
npm install
npm run db:push                                  # create tables
DATABASE_URL=postgres://sigma:sigma@localhost:55432/sigma_test npx drizzle-kit push  # test DB
npm run db:migrate-json                          # import legacy data/*.json content
SEED_ADMIN_EMAIL=admin@sigmaalutech.in SEED_ADMIN_PASSWORD=sigma-admin-2026 npm run db:seed-admin
npm run db:seed-payroll                          # demo staff register (invented data)

# 3. Run
npm run dev            # http://localhost:3000  (admin at /admin)
```

`.env.local` points at the docker database. See `.env.example` for all variables.

## Tests

```bash
npm test               # Vitest: unit + integration (needs docker Postgres)
npm run test:e2e       # Playwright: full user flows incl. admin CRUD + upload
npm run test:all
```

Payroll tests need the demo register: `npm run db:seed-payroll`.

Playwright boots its own dev server on port 3100. Coverage includes: public
pages rendering from the database, category filters and deep links, product and
project detail routes plus their 404s, the three navigation bar variants, theme
persistence, admin login guards, list search/filter/star-toggle, editor
dirty-state and reordering, and a full product create → verify-on-site → edit →
delete lifecycle with a real image upload. For payroll: the salary formula
against hand-checked figures, workbook parsing, the snapshot and cascade rules
in the database, and a full month end-to-end — upload → live recalculation →
save → generate 8 PDFs → simulated send with one person correctly skipped.

## Code map

- `src/db/schema.ts` — categories, products, project_categories, projects, admins.
  List-like fields (features, specs, finishes, images) are JSONB.
- `src/lib/catalog.ts` — all queries and mutations, including the derived
  "projects that used this category" and next-project lookups.
- `src/lib/validation.ts` — Zod input schemas and YouTube URL normalization
  (accepts watch / shorts / embed links).
- `src/lib/storage.ts` — upload driver: Vercel Blob when `BLOB_READ_WRITE_TOKEN`
  is set, `public/uploads/` otherwise. 8 MB limit, images only.
- `src/lib/site.ts` — company contact details used across the chrome.
- `src/lib/payroll/calc.ts` — the salary formula (pro-rata, overtime at an
  8.5-hour day, allowances, deductions) plus rupee/paise helpers.
- `src/lib/payroll/import.ts` — reads the office workbook by column position,
  tolerating its blank spacer rows, and matches names to employees.
- `src/lib/payroll/pdf.ts` — the payslip layout (pdf-lib; letter-spacing is
  drawn by hand since pdf-lib has no `characterSpacing`).
- `src/lib/payroll/whatsapp.ts` — provider interface, phone normalisation to
  `91…`, the message wording, and the mock/Meta implementations.
- `src/lib/payroll/store.ts` — employee CRUD and run/line persistence; derived
  figures are recomputed on save rather than trusted from the client.
- `src/app/api/*` — REST routes. GETs are public; POST/PUT/DELETE require the
  admin session cookie. Errors map uniformly to 400/401/404/409.
- `src/styles/*` — design tokens plus component/page layers; `variables.css`
  holds the light palette with a `[data-theme="dark"]` override block.
- Legacy images were copied to `public/images/` so migrated content keeps its
  original URLs; new uploads go to Blob.
