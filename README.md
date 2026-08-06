# Sigma Alutech

Aluminium fabrication in Bangalore — formerly Ravi Enterprises, and an
authorized **Technal** (France) franchisee through Hydro BS India.

This repository holds the company's website and the office's payroll tool.

| | |
|---|---|
| **App** | [`web/`](web/README.md) — Next.js 16, Postgres, Vercel Blob, custom admin, payroll |
| **Live** | https://sigmaalutech.in · admin at `/admin` |
| **Also on** | https://sigma-alutech.vercel.app (the Vercel URL, still valid) |
| **Legacy site** | repository root — **retired**, no longer served anywhere ([documented](docs/legacy-static-site.md)) |

The app does three jobs: it publishes the product catalog and project
portfolio, it lets the owner edit both in the browser without touching code,
and it turns the office's monthly salary spreadsheet into payslip PDFs
delivered to each employee over WhatsApp.

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

  visitor -->|"sigmaalutech.in"| edge
  owner --> fn

  fn -->|"SQL over TLS · pooled"| neon[("Neon Postgres · ap-southeast-1<br/>catalog · projects · admins · payroll")]
  fn -->|"put / del · server-side token"| blob["Vercel Blob · sigma-alutech-blob<br/>photography · payslip PDFs"]
  visitor -.->|"public URLs, served direct"| blob
  fn -. "not connected yet" .-> wa["WhatsApp Business Cloud API"]
  wa -. "payslip PDF" .-> staff

```

One Vercel deployment serves everything. Public pages are server-rendered per
request (`dynamic = 'force-dynamic'`), so a catalog edit appears immediately
without a rebuild. Uploaded images are served **directly from the Blob host**
to the browser, never proxied through the app.

One path exists in code but carries no traffic yet, drawn dashed above:

- **WhatsApp** — the integration is built: send, delivery webhook, per-line
  status, and a settings screen at `/admin/whatsapp` that lists what is still
  missing and sends a test message. While `WHATSAPP_PROVIDER` is not `meta`,
  sends are simulated — validated and recorded against each payslip line,
  delivered to nobody. Going live needs a verified WhatsApp Business account, a
  business number (a personal number cannot be automated) and an approved
  message template. See
  [Connecting WhatsApp](web/README.md#connecting-whatsapp).
- ~~**The domain**~~ — done. `sigmaalutech.in` and `www.` resolve to Vercel and
  serve the app over HTTPS.

## Managed services

| Service | Instance | Holds |
|---|---|---|
| **Vercel** | project `sigma-alutech`, root directory `web`, Node 24.x | the app |
| **Neon Postgres** | `ep-twilight-sea-azrzayre-pooler…ap-southeast-1`, pooled, `sslmode=require` | `categories`, `products`, `project_categories`, `projects`, `admins`, `employees`, `payroll_runs`, `payroll_lines` |
| **Vercel Blob** | store `sigma-alutech-blob` | uploaded photography, generated payslip PDFs |
| **GitHub Actions** | `.github/workflows/tests.yml` | CI on every push and PR to `main` |

Blob objects are written `access: 'public'` under `uploads/<folder>/` with
unguessable keys. Public means *readable by URL*; writing and deleting need the
server-side token, which never reaches the browser. The Postgres pool is capped
at one connection per invocation in production — serverless functions are
short-lived.

## Environments

| | Production | Preview | Local |
|---|---|---|---|
| Host | Vercel (`sigmaalutech.in`) | Vercel per-branch/PR URL | `next dev` on :3000 |
| Database | Neon `neondb` | Neon `neondb` (**same DB**) | Docker `sigma` on :55432 |
| Images | Vercel Blob | Vercel Blob (same store) | `public/uploads/` |
| WhatsApp | mock until configured | mock | mock |
| Trigger | push to `main`, or `vercel deploy --prod` | any other push | manual |

> **Preview deployments share the production database and blob store.** A
> preview build can therefore write real content. Until that is separated,
> treat previews as production for anything that mutates data.

## Deploy pipeline

```
push to main ──┬──▶ GitHub Actions ── legacy Vitest
               │                    └ web: schema push → JSON migrate → seed →
               │                         Vitest (103) → Playwright (52)
               └──▶ Vercel ── npm ci → next build → promote to production
```

Three things about this are worth knowing before you rely on it:

1. **The two run independently.** Vercel does not wait for CI, so a red build
   can still reach production.
2. **The git integration has a history of going quiet.** It stopped deploying
   altogether when the repository moved to the `Dyuthix` organisation on
   2026-08-05, because the Vercel GitHub App had not been granted access there.
   And on 2026-07-27 it silently skipped one push while deploying the ones
   either side. Verified working again on 2026-08-06: a push produced a
   production build three seconds later.

   Both failures were silent — a push that never deploys looks exactly like one
   that did. After pushing anything that matters:

   ```bash
   cd web && vercel ls sigma-alutech    # is there a build for your commit?
   cd web && vercel deploy --prod        # ship it by hand if not
   ```

3. **Migrations do not run during the build.** Apply schema changes from a
   workstation *before* deploying code that depends on them:

   ```bash
   cd web
   DATABASE_URL='<neon-connection-string>' npm run db:push
   ```

CI provisions its own throwaway Postgres container, so it never touches Neon.

## Environment variables

Set in Vercel → Settings → Environment Variables (Production + Preview). Full
table, including the WhatsApp group, in
[`web/README.md`](web/README.md#environment-variables).

| Name | Purpose |
|---|---|
| `DATABASE_URL` | all database access |
| `BLOB_READ_WRITE_TOKEN` | image and payslip upload. **Absent ⇒ the app falls back to the filesystem and uploads fail on Vercel** |
| `SESSION_SECRET` | signs the admin session cookie; rotating it logs every admin out |
| `WHATSAPP_*` | payslip delivery; simulated until `WHATSAPP_PROVIDER=meta` |

## Runbook

```bash
cd web

vercel deploy --prod          # deploy the working tree to production
vercel ls sigma-alutech       # what is live, and its build status
vercel logs <deployment-url>  # runtime logs: server errors, DB failures
vercel promote <older-url>    # roll back to a previous deployment
```

---

## Local development

```bash
# 1. Postgres (once)
docker run -d --name sigma-pg -e POSTGRES_PASSWORD=sigma -e POSTGRES_USER=sigma \
  -e POSTGRES_DB=sigma -p 55432:5432 postgres:16-alpine
docker exec sigma-pg psql -U sigma -c "CREATE DATABASE sigma_test;"

# 2. Schema, content and logins
cd web
npm install
npm run db:push
DATABASE_URL=postgres://sigma:sigma@localhost:55432/sigma_test npx drizzle-kit push
npm run db:migrate-json
SEED_ADMIN_EMAIL=admin@sigmaalutech.in SEED_ADMIN_PASSWORD=sigma-admin-2026 npm run db:seed-admin
npm run db:seed-payroll        # demo staff register (invented data)

# 3. Run
npm run dev                    # http://localhost:3000, admin at /admin
```

## Tests

```bash
cd web
npm test          # Vitest: unit + integration against the docker Postgres
npm run test:e2e  # Playwright: full user flows, desktop and phone
npm run test:all
```

`npm test` in the repository *root* is a different suite — it covers the legacy
static site, and CI runs both.

Real salary data is **never** committed; this repository is public. The payroll
tests run against an invented eight-person fixture, and the formula was
reconciled against a real month's sheet locally before anything was committed.

## Where things live

```
sigma-alutech/
├── web/                    # the app — see web/README.md
│   ├── src/app/            # routes: public pages, /admin, /api
│   ├── src/components/     # public and admin components
│   ├── src/lib/payroll/    # calc, sheet import, PDF, WhatsApp, store
│   ├── src/db/schema.ts    # Drizzle schema
│   └── tests/              # unit, integration, e2e
├── docs/
│   └── legacy-static-site.md
├── .github/workflows/      # CI
└── index.html, css/, js/, data/, images/    # legacy static site
```
