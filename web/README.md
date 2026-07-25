# Sigma Alutech — Dynamic Website (Next.js)

The dynamic replacement for the static GitHub Pages site in the repo root.
Product catalog and project portfolio live in **Postgres**; images upload to
**Vercel Blob** (production) or `public/uploads/` (local dev); a custom
**admin panel** at `/admin` manages everything with email + password login.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Database | Postgres — Neon / Vercel Postgres in production, Docker locally |
| ORM | Drizzle |
| Image storage | Vercel Blob (`BLOB_READ_WRITE_TOKEN`) with local-filesystem fallback |
| Auth | Email + password (bcrypt) with signed HttpOnly session cookies (jose) |
| Validation | Zod (shared schemas for API input) |
| Tests | Vitest (unit + integration vs real Postgres) & Playwright (e2e) |
| Hosting | Vercel |

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

`.env.local` already points at the docker database. See `.env.example` for all variables.

## Tests

```bash
npm test               # Vitest: unit + integration (needs docker Postgres)
npm run test:e2e       # Playwright: full user flows incl. admin CRUD + upload
npm run test:all
```

The e2e suite boots its own dev server on port 3100 and exercises: public pages
rendering from the DB, filters, modals, theme toggle persistence, login guards,
bad-password errors, and a full product create → verify-on-site → edit → delete
lifecycle including a real image upload.

## Deploying to Vercel (one-time setup)

1. **Create the Vercel project**: [vercel.com/new](https://vercel.com/new) → import
   `crazycoder22/sigma-alutech` → set **Root Directory = `web`**. Framework auto-detects.
2. **Database**: in the Vercel project → Storage → create a **Postgres (Neon)** database.
   This auto-sets `DATABASE_URL`. (Or create a DB at neon.tech and set `DATABASE_URL` manually.)
3. **Blob storage**: Storage → create a **Blob** store. This auto-sets `BLOB_READ_WRITE_TOKEN`.
4. **Env vars**: add `SESSION_SECRET` (run `openssl rand -hex 32`).
5. **Schema + content**: from your machine, run against the production DB:
   ```bash
   DATABASE_URL='<neon-connection-string>' npm run db:push
   DATABASE_URL='<neon-connection-string>' npm run db:migrate-json
   DATABASE_URL='<neon-connection-string>' SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run db:seed-admin
   ```
6. **Domain**: point `sigmaalutech.in` at the Vercel project (Project → Domains).
   Remove the GitHub Pages CNAME once traffic is switched.

After that, every push to `main` auto-deploys, and the admin manages all
content at `sigmaalutech.in/admin` — no GitHub involvement.

## Architecture notes

- `src/db/schema.ts` — categories, products, project_categories, projects, admins.
  List-like fields (features, specs, finishes, images) are JSONB.
- `src/lib/catalog.ts` — all queries/mutations. `src/lib/validation.ts` — Zod input
  schemas + YouTube URL normalization (accepts watch/short/embed links).
- `src/lib/storage.ts` — upload driver: Vercel Blob when `BLOB_READ_WRITE_TOKEN` is
  set, `public/uploads/` otherwise. 8 MB limit, images only.
- `src/app/api/*` — REST routes. GETs are public; POST/PUT/DELETE require the
  admin session cookie. Errors are mapped uniformly (401/400/404/409).
- Legacy images were copied to `public/images/` so all migrated content keeps
  its original URLs; new uploads go to Blob.
- The legacy static site still lives at the repo root and keeps serving on
  GitHub Pages until the domain is switched to Vercel.
