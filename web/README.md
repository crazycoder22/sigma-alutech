# Sigma Alutech — Dynamic Website (Next.js)

The dynamic replacement for the static GitHub Pages site in the repo root.
Product catalog and project portfolio live in **Postgres**; images upload to
**Vercel Blob** (production) or `public/uploads/` (local dev); a custom
**admin panel** at `/admin` manages everything with email + password login.

**Live:** https://sigma-alutech.vercel.app · admin at `/admin`
**Public domain:** `sigmaalutech.in` still serves the *legacy* static site on
GitHub Pages — see [Domain cutover](#domain-cutover-not-done-yet).

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
| Tests | Vitest (unit + integration vs real Postgres) · Playwright (e2e) |
| CI | GitHub Actions on every push and PR to `main` |

---

# Deployment architecture

## Topology

```mermaid
flowchart LR
  visitor([Visitor])
  owner([Admin])

  subgraph vercel["Vercel · project sigma-alutech · root directory web/"]
    edge["Edge network<br/>static assets, JS/CSS bundles"]
    fn["Next.js server<br/>server components + /api routes"]
    edge --> fn
  end

  visitor --> edge
  owner --> fn
  fn -->|"SQL over TLS"| neon[("Neon Postgres · ap-southeast-1<br/>products · projects · admins")]
  fn -->|"put / del · server-side token"| blob["Vercel Blob · sigma-alutech-blob<br/>uploaded photography"]
  visitor -.->|"public image URLs, served direct"| blob
```

Every public page is server-rendered per request (`dynamic = 'force-dynamic'`)
so catalog edits appear immediately without a rebuild. Uploaded images are
served **directly from the Blob host** to the browser, not proxied through the
app.

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
Holds `categories`, `products`, `project_categories`, `projects`, `admins`.
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

`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` are **not** deployed — they are only
read by the local seed script.

A leftover variable named `test` exists in the project from initial setup and
can be deleted; nothing reads it.

## Deploy pipeline

```
push to main ──┬──▶ GitHub Actions ── legacy Vitest
               │                    └ web: schema push → JSON migrate → seed →
               │                         Vitest (29) → Playwright (37)
               └──▶ Vercel ── npm ci → next build → promote to production
```

The two run **independently** — Vercel does not wait for CI, so a red build can
still deploy. Check the Actions tab after pushing, or deploy deliberately with
`vercel deploy --prod` once CI is green.

CI provisions its own throwaway Postgres service container, so it never touches
Neon.

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

To add or reset an admin login:

```bash
cd web
DATABASE_URL='<neon-connection-string>' \
SEED_ADMIN_EMAIL='someone@example.com' \
SEED_ADMIN_PASSWORD='<strong password>' \
npm run db:seed-admin
```

## Domain cutover (not done yet)

`sigmaalutech.in` currently resolves to **GitHub Pages**, serving the legacy
static site from the repo root (`CNAME` + `.nojekyll` at the root). The Next.js
app is only reachable at its Vercel URL.

To switch:

1. Vercel → project → **Domains** → add `sigmaalutech.in` and `www.sigmaalutech.in`.
2. Update the DNS records at the registrar to the values Vercel shows
   (replacing the GitHub Pages `A`/`CNAME` records).
3. Once traffic is confirmed on Vercel, delete the root `CNAME` file and
   disable GitHub Pages so the two can't diverge.
4. Optional: remove the legacy site (root `index.html`, `css/`, `js/`, `data/`,
   `admin/` Decap config) — the Next.js app supersedes all of it.

Until step 3, **both sites are live** on different hostnames from the same repo.

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

Playwright boots its own dev server on port 3100. Coverage includes: public
pages rendering from the database, category filters and deep links, product and
project detail routes plus their 404s, the three navigation bar variants, theme
persistence, admin login guards, list search/filter/star-toggle, editor
dirty-state and reordering, and a full product create → verify-on-site → edit →
delete lifecycle with a real image upload.

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
- `src/app/api/*` — REST routes. GETs are public; POST/PUT/DELETE require the
  admin session cookie. Errors map uniformly to 400/401/404/409.
- `src/styles/*` — design tokens plus component/page layers; `variables.css`
  holds the light palette with a `[data-theme="dark"]` override block.
- Legacy images were copied to `public/images/` so migrated content keeps its
  original URLs; new uploads go to Blob.
