# Munnudi

Personal rental-property and loan tracker — one property, six units, four loans,
monthly accounting grain, INR.

Built from [`Munnudi_PRD.md`](./Munnudi_PRD.md). Engineering decisions, the defects found in
the PRD's data model, and the phased build order live in
[`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5.9 · Tailwind CSS 4 · shadcn/ui (Radix) ·
Recharts · PostgreSQL 17 · Drizzle ORM · Vitest

## Prerequisites

- **Node 24** — `nvm use` picks it up from `.nvmrc`
- **pnpm 11**
- **Docker** — for local Postgres

## Setup

```bash
nvm use                 # Node 24.18.0, per .nvmrc
pnpm install

cp .env.example .env.local   # then edit if needed — see below

docker compose up -d    # Postgres 17 on host port 5433
pnpm dev                # http://localhost:3000
```

> **`.env.local` must be created by hand.** It is intentionally not committed and
> not generated. Copy `.env.example` and adjust. Required keys:
>
> | Key            | Purpose                                                                                                                                           |
> | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
> | `DATABASE_URL` | Postgres connection. Default matches `docker-compose.yml` (port **5433**, chosen so it will not clash with any Postgres you already run on 5432). |
> | `APP_TIMEZONE` | Property timezone, default `Asia/Kolkata`. Resolves "current month" — see below.                                                                  |

## Scripts

| Command                         | Purpose                                         |
| ------------------------------- | ----------------------------------------------- |
| `pnpm dev`                      | Dev server                                      |
| `pnpm build` / `pnpm start`     | Production build / serve                        |
| `pnpm test` / `pnpm test:watch` | Vitest (pure domain tests, no DB needed)        |
| `pnpm typecheck`                | `tsc --noEmit`                                  |
| `pnpm lint` / `pnpm format`     | ESLint / Prettier                               |
| `pnpm verify`                   | typecheck + lint + test — run before committing |

## Project structure

```
src/
  domain/      Pure calculation engine. No DB, no I/O, no framework imports.
               All KPI maths lives here so it is unit-testable and so the
               Dashboard and Reports cannot disagree — both call the same code.
  app/         Next.js App Router. (app)/ is the shell-wrapped route group.
  components/  App shell, shared UI, and shadcn components in ui/.
  lib/         Config, nav, and small helpers.
docs/          Implementation plan and decision records.
```

## Things that look odd but are deliberate

**Money is never a float.** Postgres stores `numeric(14,2)`; the driver returns a
string; `src/domain/money.ts` parses it into integer **paise**. All arithmetic is
integer, so addition and subtraction never round. `parseFloat(s) * 100` is
specifically avoided — `parseFloat("1234567.89") * 100` is `123456788.99999999`.

**Months are `"YYYY-MM"` strings, not dates.** `pg` parses a `date` into a JS Date at
_local_ midnight; in IST `2025-03-01` becomes `Mar 1 00:00+05:30`, whose
`.toISOString().slice(0,7)` is `"2025-02"` — March data silently filed under
February. Since all computation happens in TypeScript, SQL date arithmetic buys
nothing, so text wins. See `src/domain/month.ts`.

**"Current month" is resolved in the property timezone, never from UTC.** On a UTC
host, 1 April 02:00 IST is still 31 March UTC, so a naive resolver would show
March for the first 5.5 hours of every month.

**INR formatting is snapshot-tested to the exact string.** Indian lakh/crore grouping
(`₹1,23,456.00`) needs full ICU data; without it output silently degrades to
Western grouping. The test is the only thing that catches that.

**The month lives in the URL** (`?m=2026-09`), so it survives refresh, is shareable,
is readable by server components, and makes backfilling past months work with no
extra tooling.

## Status

Phase 1 of 8 complete: foundation, app shell, month selector, money and month
domain modules with tests. See the plan for the remaining phases.
