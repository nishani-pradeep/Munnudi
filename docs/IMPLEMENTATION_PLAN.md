# Munnudi — Implementation Plan

## Context

`Munnudi_PRD.md` is a complete, build-ready PRD for a personal rental-property and loan tracker:
1 property, 6 units (4×2BHK + 2×1BHK, one self-occupied), 4 loans (3 home + 1 gold), monthly
accounting grain, INR. The repository is otherwise **empty** — no commits, no code.

This plan turns that PRD into a working application. It is deliberately **not** a restatement of
the PRD. It records the engineering decisions the PRD left open and the **defects found in the
PRD's own data model** — several of which would have silently corrupted historical figures.

Goal: a correct, durable personal tracker where every dashboard number is derived from source
records, reconciles with the reports, and can never be silently rewritten by a later edit.

### Status

**Phases 0-2 are committed** on `build/munnudi-mvp`. Foundation, app shell, month selector,
the full 11-table schema with migrations, the property-scoping chokepoint, backup/restore/
export, skeleton + 12-month demo seed, and a working `/rent` entry screen are all built and
verified against a live Postgres 17 container — see the build log at the bottom of this
document for exactly what was verified and what was found by testing rather than assumed.

### Decisions taken from you

| Question                            | Answer                                | Consequence                                                        |
| ----------------------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| Which categories are "Maintenance"? | **All six**                           | `Operating Profit = Rent − all expenses`. Flag stays editable.     |
| Historical backfill?                | **~2 prior months**                   | Month selector reaches any past month; no importer needed.         |
| Seed data?                          | **Realistic demo**                    | 12 months of plausible history + reset script.                     |
| Hosting?                            | **Local now, deploy later**           | Plain Postgres in Docker. Vendor-neutral.                          |
| Data safety?                        | **Full kit**                          | Backup/restore scripts, CSV export, soft deletes, audit log.       |
| Vacant units in target?             | **Yes + Vacancy Loss KPI**            | Collection Rate is economically honest; causes separable.          |
| Authorization?                      | **"Don't worry too much — self use"** | No Supabase Auth/RLS. See [decision 8](#8-authorization-honestly). |

---

## Verification status of external facts

**Web research was unavailable this session.** `WebSearch` is blocked by org policy,
`WebFetch` is disabled, `curl` was denied. I did **not** substitute remembered version numbers.

Everything below was verified live against the **npm registry** via `npm view`, which does work.

| Package                                          | Verified                                       | Note                                                      |
| ------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------- |
| `next`                                           | **16.3.5**                                     | `engines: node >=20.9.0`                                  |
| `react` / `react-dom`                            | **19.3.0**                                     |                                                           |
| `typescript`                                     | **7.0.2**                                      | native Go compiler; **fallback `^5.9`** if tooling lags   |
| `tailwindcss`                                    | **4.3.3**                                      | v4 CSS-first `@theme`; no `tailwind.config.ts`            |
| `shadcn` (CLI)                                   | **4.21.0**                                     | scaffolder only; see primitives note below                |
| `radix-ui`                                       | **1.6.7**                                      | **stable**                                                |
| `@base-ui-components/react`                      | **1.0.0-rc.0**                                 | **release candidate** — shadcn's newer default foundation |
| `drizzle-orm` / `drizzle-kit`                    | **0.45.2** / **0.31.10**                       |                                                           |
| `recharts`                                       | **3.10.1**                                     |                                                           |
| `zod` / `vitest`                                 | **4.6.2** / **5.0.0**                          |                                                           |
| `@tanstack/react-table`                          | **9.2.4**                                      |                                                           |
| `react-hook-form` / `@hookform/resolvers`        | **7.88.0** / **5.9.1**                         |                                                           |
| `lucide-react` / `date-fns` / `next-safe-action` | **1.45.0** / **4.4.0** / **8.7.3**             |                                                           |
| `next-auth`                                      | `latest` = **4.24.15**, v5 = **5.0.0-beta.32** | v5 **never shipped stable**                               |
| `prisma`                                         | **8.0.0-rc.14**                                | **RC, not stable**                                        |

**Unverified — re-check at deploy:** Vercel Hobby terms, any cloud Postgres free tier.
Deferred by design; Phase 8 chooses a host once these can be checked.

Local: Node **24.18.0** (LTS Krypton, already installed via nvm — will pin `.nvmrc`),
pnpm 10.33.2, Docker 29.7.2, gh 2.98.0. No Supabase CLI or `psql` needed under this plan.

---

## Tech stack, and why

| Layer      | Choice                                      | Rationale                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime    | **Node 24.18.0** (`.nvmrc`)                 | LTS; comfortably above Next 16's ≥20.9.0                                                                                                                                                                                   |
| Framework  | Next.js 16.3.5 App Router, React 19.3       | PRD-specified; Server Actions keep data access server-side                                                                                                                                                                 |
| Language   | TypeScript 7.0.2                            | now `latest`; fallback pinned if any tool chokes                                                                                                                                                                           |
| Styling    | Tailwind CSS 4.3.3                          | CSS-first config                                                                                                                                                                                                           |
| Components | **shadcn/ui 4.21**, **Radix primitives**    | Code lives in our repo — no black-box upgrades. Dense, classy financial-dashboard aesthetic; first-class Tailwind v4; built-in Recharts wrapper. **Primitives: Radix 1.6.7 (stable), not Base UI 1.0.0-rc.0** — see below. |
| Charts     | Recharts 3.10.1                             | Covers all 8 PRD charts                                                                                                                                                                                                    |
| Database   | **Plain PostgreSQL 17 in Docker**           | Vendor-neutral. Deploying later is a connection-string change.                                                                                                                                                             |
| ORM        | **Drizzle 0.45.2**                          | Stable (**Prisma 8 is only RC**); SQL-first suits `numeric` money and generated columns                                                                                                                                    |
| Mutations  | Server Actions + `next-safe-action` + Zod 4 | Typed, validated, server-only                                                                                                                                                                                              |
| Tests      | Vitest 5                                    | PRD §22's scenarios become pure unit tests                                                                                                                                                                                 |

**Rejected:** _Supabase_ — its main draw was bundled Auth+RLS, which self-use makes unnecessary,
and its ~1-week idle pause is bad for a monthly-use app. _Auth.js_ — v5 still beta.
_Prisma_ — RC. _A separate backend_ — ruled out by PRD §16.1; write volume is trivial.

**On shadcn primitives.** shadcn has shifted its default unstyled foundation from Radix to
**Base UI**, which is currently **`1.0.0-rc.0` — a release candidate**. Having rejected Prisma 8
and Auth.js v5 on exactly that basis, the same standard applies here: **Phase 1 pins the
Radix-backed components (`radix-ui` 1.6.7, stable)**. Because shadcn copies component source into
our repo, this is a contained, reversible choice — if Base UI is stable by the time we build, we
reassess in Phase 1. Verified at Phase 1 by inspecting what `shadcn add` actually pulls.

---

## Architectural decisions

### 1. A pure calculation engine

All KPI math lives in `src/domain/` as **pure functions over plain arrays** — no DB, no I/O, no
framework imports. The entire lifetime dataset of this app is a few hundred KB (6 units × 12
months × 10 years ≈ 720 census rows), so **everything is computed in memory. No aggregation SQL.**

This is what makes PRD §22 "Dashboard and report totals match" true _by construction_: both
call the same function. The domain package must not import the schema, or the boundary is
decorative.

```
src/domain/  money.ts · month.ts · rent.ts · expenses.ts · loans.ts · kpi.ts · flags.ts
```

Soft-deleted rows and policy toggles are **passed into** the domain, never filtered in SQL —
otherwise §22's soft-delete scenario can't be unit-tested.

### 2. Money and readings

Postgres `numeric(14,2)`; Drizzle returns **strings**; parsed to a branded integer `Paise` type.
All arithmetic is integer, so **addition and subtraction never round**.

- **Parse exactly** — split on `.`, pad, concat. Never `parseFloat(s) * 100`
  (`parseFloat("1234567.89") * 100` = `123456788.99999999`).
- Rounding happens in exactly two display-only places: Collection Rate and averages. These are
  typed as non-composable (`DisplayRate`, `DisplayAverage`) so nobody feeds an average back into
  a calculation.
- **Meter readings are not money** — no universal scale exists (PRD §8 forbids hard-coded
  conversion). `numeric(14,3)` **plus a unit-of-measure snapshot on every row**; otherwise
  switching a unit from litres to kL silently rewrites every prior chart by 1000×.
- `interest_rate` → `numeric(6,3)`.
- **ICU trap:** snapshot-test that INR renders exactly `₹1,23,456.00`. Without full ICU data the
  grouping silently degrades to Western `₹123,456.00`, violating §15. Pin
  `currencyDisplay: 'narrowSymbol'` and decide the negative format explicitly.

### 3. Month = `varchar(7)` `'YYYY-MM'`, not `date`

`pg-types` parses a `date` into a JS `Date` at _local_ midnight. In IST, `2025-03-01` becomes
`Mar 1 00:00 +05:30`, and `.toISOString().slice(0,7)` yields **`"2025-02"`** — March data files
itself under February, at every JSON/CSV/chart boundary, for every user east of UTC.

`date`'s only real advantage is SQL date arithmetic, and decision 1 puts all computation in
TypeScript — so that advantage doesn't exist here. Text sorts chronologically when zero-padded
and needs zero conversions. Requires a regex CHECK (Postgres would happily store `'2025-13'`).

Also: compute "current month" in `properties.timezone`. On a UTC server, `2025-04-01 02:00 IST`
resolves to March for the first 5.5 hours of every month.

### 4. PRD DEFECT — history is computed from mutable current state ⚠️

`units.occupancy_status`, `units.active`, and `loans.active` are all single current values, but
Rental Target and Loan Balance Trend are **historical** metrics. Make Unit 3 self-occupied today
and January's target silently drops it — rewriting a closed month.

**Fix — a monthly unit census.** Rename `rent_records` → **`unit_month_records`** and generate a
row for **every active unit every month**, including self-occupied ones, with occupancy and rent
**snapshotted** at generation. PRD §6.2's Unit Collection Matrix already requires "Self Occupied"
as a _cell state_, which only exists if the row exists.

Historical target = `SUM(expected_rent_snapshot) WHERE is_billable` — derived purely from the
census. **Rule: never filter a historical query by `units.active`.** For loans, use
`closed_month` and filter `month <= closed_month`, never the current `active` boolean.

Occupancy uses **carry-forward generation** (`COALESCE(previous month's snapshot, unit default)`)
with an "apply from this month forward" action — **not** a versions table. A versions table would
store the same fact twice and recreate exactly the dual-source-of-truth bug called out in
decision 5. Generation is `ON CONFLICT DO NOTHING`, so re-running never clobbers entered payments.

**Facts get snapshotted; policies don't.** Occupancy is snapshotted. The self-occupied toggle,
vacancy treatment, and `is_maintenance` are _policies_ — evaluated at read time so flipping one
reinterprets all history consistently.

### 5. PRD DEFECT — loan balance has two sources of truth ⚠️

`outstanding_after_payment` is stored, yet §22 also demands it reconcile to
`opening − Σprincipal`. These will drift, and §22's own wording — "plus **adjustments**" —
names a column §17 never models.

- Add **`principal_adjustment`** (signed) + **`adjustment_reason`**, making the identity exact:
  `outstanding_after = outstanding_before − principal_paid + principal_adjustment`.
  Capitalized gold-loan interest, penalties and outside prepayments become _recorded events_
  rather than a permanent warning banner that everyone learns to ignore.
- Add **`opening_as_of_month`** — without it the recurrence has no anchor.
- **Make `outstanding_after_payment` NULLABLE** (contra §10.1). Forcing it makes users invent a
  number that then becomes "authoritative". `effective = COALESCE(entered, derived)`; drift is
  only computed when the user actually entered a statement balance.
- Drift is **per-row via `LAG`**, not a global total: _"Home Loan 2, March: expected ₹18,40,000,
  recorded ₹18,52,340, unexplained +₹12,340"_ — actionable. Exposed as view `v_loan_ledger`.
- **No CHECK that the balance decreases** — §14 lists an increase as a _flag_, and gold loans
  legitimately grow.
- `scheduled_emi` nullable + **`expects_monthly_payment`**, so a bullet-repayment gold loan
  doesn't fire a false "repayment missing" flag every month.
- `SUM(latest outstanding)` is **not** a SUM over the selected month — it's a per-loan
  as-of lookup (last row `month <= selected`, else opening), then summed.

### 6. PRD DEFECT — the close lifecycle is modelled as a linear enum ⚠️

§12's OPEN → RENT → UTILITIES → EXPENSES → LOANS → REVIEW → CLOSED is stored as one `state`
column, but these aren't mutually exclusive states — it's a **checklist**. Real use is "rent,
then loans, then utilities three days later", which a linear enum turns into "state went
backwards" bugs.

```
state text CHECK IN ('OPEN','CLOSED')   -- the lock, and only the lock
rent_reviewed_at / utilities_reviewed_at / expenses_reviewed_at / loans_reviewed_at
```

This fixes the lifecycle **and** supplies the completeness signal decision 7 needs.

### 7. "Not entered" vs ₹0 — and never average a ratio

Two classes of metric:

- **Auto-derivable** (rent, loan repayments) — the expected row set is knowable, so a gap is
  detectable.
- **Unfalsifiable by absence** (expenses, utility bills) — zero rows is ambiguous between "spent
  ₹0" and "haven't entered it". **Only a user assertion resolves this**, which is exactly what
  `expenses_reviewed_at` provides.

Averages **exclude unknown months from both numerator and denominator**, and always return
coverage, via a three-state type:

```ts
type Measure =
  | { kind: "value"; paise: Paise; basisMonths: number }
  | { kind: "partial"; paise: Paise; basisMonths: number; missing: MonthKey[] }
  | { kind: "unknown"; missing: MonthKey[] };
```

so a card can honestly read **"₹2,40,000 · 10 of 12 months"**.

> **Never average a ratio.** Average Collection Rate is `Σcollected ÷ Σtarget`, **not**
> `mean(monthly rates)`. Jan target ₹10k collected 100%; Feb target ₹1L collected 50% →
> mean of rates = **75%**, true rate = **54.5%**. The mean weights a ₹10k month equally with a
> ₹1L month, and diverges worst exactly when a unit goes vacant. Enforced by typing: no function
> accepts `number[]` of percentages.

Zero target returns `null` all the way to the renderer, displayed `—`, never `0%`.
`Outstanding Principal` is a **stock**, not a flow: as-of only; the scope toggle disables
sum/average rather than computing nonsense.

**Accrual basis** (unstated in the PRD, decides half the KPI semantics): `month` is the
obligation, `payment_date` is cash-timing metadata. January arrears paid in February record
against **January**. So Till-Now Pending is `MAX(Σtarget − Σcollected, 0)`, and the monthly chart
series is labelled "monthly shortfall" — visibly a different quantity, so both can be correct.
An `OVERPAID` status makes genuine overpayment visible rather than silently absorbed.

### 8. Authorization, honestly

You said not to over-invest here, and that changes what's _correct_ to build.

A silent trap: with Drizzle connecting as a single pooled owner role, **RLS does nothing** —
table owners bypass their own policies without `FORCE ROW LEVEL SECURITY`. Shipping policies
under that setup would be security theatre plus a false claim in the PRD's Definition of Done.

So, explicitly: **no RLS.** Instead, `property_id` scoping is enforced at a **single
query-builder chokepoint** in the data layer, which is precisely what §22's real test asks for
("unauthorized user cannot query or mutate another property's records via crafted IDs") and is
testable without a second database role. Local-only means no auth in Phases 1–7; Phase 8 adds a
single-user session login **if and when** you deploy. PRD §19/§25 are amended to match reality
rather than quietly violated.

---

## Database schema

Money `numeric(14,2)` · readings `numeric(14,3)` · months `varchar(7)` + regex CHECK · ids `uuid`.
**[NEW]** / **[CHG]** mark deviations from PRD §17.

| Table                                                                    | Key fields                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `properties`                                                             | `owner_id`, `name`, `currency` (frozen post-create), `timezone`, **`tracking_start_month`** [NEW — §11 requires it, §17 omits it], **`include_self_occupied_in_target`**, **`count_vacant_in_target` default true** [NEW]                                                                                                                                                                                                          |
| `units`                                                                  | `unit_code`, `unit_type`, **`default_occupancy_status`** [CHG — seeds month 1 only], **`electricity_uom`/`water_uom`** [NEW], `active` · **unique (property, unit_code)** [NEW]                                                                                                                                                                                                                                                    |
| `unit_rent_versions`                                                     | `unit_id`, `effective_month`, `expected_rent` · unique (unit, effective_month)                                                                                                                                                                                                                                                                                                                                                     |
| **`unit_month_records`** [CHG — renamed from `rent_records`; the census] | `property_id`, `unit_id`, `month`, **`occupancy_snapshot`** [NEW], `expected_rent_snapshot` (populated even when self-occupied, so future opportunity-cost views stay reconstructable), **`is_billable` GENERATED**, **`paid_amount` NULLABLE** (NULL = not entered — the single most important nullability in the schema), `payment_date`, **`status` GENERATED** (UNSET/UNPAID/PARTIAL/PAID/OVERPAID/NOT_BILLABLE), `deleted_at` |
| `utility_records`                                                        | `property_id`, `unit_id`, `month`, `utility_type`, **`uom_snapshot`** [NEW], `previous_reading`, `current_reading`, **`usage_override`** [CHG — replaces ambiguous stored-and-derived `usage`], **`meter_event`** NONE/RESET/ROLLOVER/REPLACED [NEW — §8 requires it, §17 omits it], **`no_bill_this_month`** [NEW], `bill_amount`, `bill_paid` (tri-state), `deleted_at` · `CHECK (meter_event <> 'NONE' OR current >= previous)` |
| `expense_categories`                                                     | `name`, `is_maintenance` (**all six seeded true**), `active`                                                                                                                                                                                                                                                                                                                                                                       |
| `expenses`                                                               | `property_id`, `unit_id` nullable, `month`, `expense_date`, `category_id`, `amount`, `comment`, `deleted_at`                                                                                                                                                                                                                                                                                                                       |
| `loans`                                                                  | `name`, `loan_type`, `lender`, `original_principal`, `opening_outstanding`, **`opening_as_of_month`** [NEW], `interest_rate`, `scheduled_emi` **nullable** [CHG], **`expects_monthly_payment`** [NEW], **`closed_month`** [NEW]                                                                                                                                                                                                    |
| `loan_repayments`                                                        | `loan_id`, `month`, `payment_date`, `total_payment`, `principal_paid` (0 for gold loan), `interest_paid`, `other_charges`, **`principal_adjustment`** signed + **`adjustment_reason`** [NEW], **`outstanding_after_payment` NULLABLE** [CHG], `deleted_at`                                                                                                                                                                         |
| `monthly_status`                                                         | `state` OPEN/CLOSED [CHG], **4 × `*_reviewed_at`** [NEW], `closed_at`, `closed_by`, **`reopened_at`** [NEW]                                                                                                                                                                                                                                                                                                                        |
| `audit_log`                                                              | **`property_id`** [NEW — RLS/scoping can't follow a polymorphic ref without it], `user_id`, `entity_type`, `entity_id`, `action`, `before_json`, `after_json` · index `(property_id, entity_type, entity_id, created_at DESC)` · **append-only, written by a generic trigger** so no mutation path can forget                                                                                                                      |
| **`v_loan_ledger`** [NEW]                                                | view: `LAG`-based recurrence, `effective = COALESCE(entered, derived)`, per-row `drift`                                                                                                                                                                                                                                                                                                                                            |

**All uniqueness must be partial** — `WHERE deleted_at IS NULL`. Otherwise soft-deleting a wrong
repayment and entering the correction hits a unique violation on the very first correction.
`deleted_at` goes on all four transactional tables (§3 asks to reverse _any_ entry), with a
`restore` operation — §22 requires records stay recoverable but §18 never defines one.

**On `is_maintenance`:** it's a _policy_, so it stays editable and reinterprets history
consistently (same as the vacancy and self-occupied toggles). The UI will warn that changing it
moves historical Operating Profit, and the change is audit-logged.

---

## Phase 2, in detail: storage, the backend API, and how a month gets filled in

Direct answer to "is storage available, are backend APIs available, how do I add data via UI":
**not yet — this is precisely what Phase 2 builds.** Nothing is wired up today. Here is exactly
what will exist afterward and how the pieces connect.

### What "backend API" means here

PRD §18 explicitly prefers **typed server functions over a broad CRUD REST API**. There is no
separate Express/route-handler API layer. The "backend" is:

1. **PostgreSQL 17** (Docker, already scaffolded in `docker-compose.yml`) — the storage.
2. **Drizzle** — typed schema + typed queries against it.
3. **Next.js Server Actions**, wrapped in `next-safe-action` — the mutation API. A Server
   Action is a function that runs only on the server, is called directly from a form/component
   like a normal async function, and is what validates and writes every change. This _is_ the
   API; there is nothing else to stand up.

### File layout

```
src/db/
  client.ts          Drizzle client (postgres-js driver) reading DATABASE_URL
  schema/
    properties.ts, units.ts, unit-rent-versions.ts, unit-month-records.ts,
    utility-records.ts, expense-categories.ts, expenses.ts,
    loans.ts, loan-repayments.ts, monthly-status.ts, audit-log.ts
    index.ts         re-exports every table, imported by client.ts
  migrate.ts          applies pending migrations against DATABASE_URL
  seed/
    skeleton.ts        1 property, 6 units, 4 loans, 6 categories — zero activity
    demo.ts            skeleton + 12 months of plausible history
  scripts/
    backup.ts, restore.ts, export-csv.ts

drizzle/               generated + hand-edited SQL migrations (see workflow below)

src/server/
  db/
    scope.ts           the property-scoping chokepoint (decision 8)
    repositories/       one file per entity; every read/write goes through here,
                         never straight from an action or component
  actions/
    client.ts           the shared next-safe-action `actionClient`
    rent.ts              saveRentAction, ensureMonthAction  (first vertical slice)
```

### Migration workflow (why it's not just `drizzle-kit push`)

Decision 8 already ruled out depending on unverified ORM helpers for RLS; the same logic
applies to generated columns, partial unique indexes, multi-column CHECKs, and the audit
trigger — none of which are simple column declarations. Workflow:

1. `src/db/schema/*.ts` declares plain column shapes only (types, not-null, defaults, FKs) —
   enough for Drizzle's TypeScript types to know every column, including generated ones.
2. `pnpm db:generate` (`drizzle-kit generate`) turns that into a first-cut SQL migration file
   under `drizzle/`.
3. **Hand-edit that one file** before applying it, adding what the plain schema can't express:
   `GENERATED ALWAYS AS (...) STORED` for `is_billable`/`status`, `CREATE UNIQUE INDEX ...
WHERE deleted_at IS NULL` for every partial-uniqueness rule, the cross-column CHECKs
   (meter-event, principal+interest+other≤total), the generic audit trigger function, and
   `v_loan_ledger`.
4. `pnpm db:migrate` applies it. Future schema changes get **new** migration files; the hand-edit
   above is never regenerated because `drizzle-kit generate` diffs against its own migration
   history, not the live database — it has no reason to touch a column it doesn't think changed.

### The scoping chokepoint (decision 8), made concrete

`src/server/db/scope.ts` resolves the one property row once per request. Every repository
function takes `propertyId` as an explicit first argument and filters by it — on **reads**, and
on **updates/deletes by id**, so a crafted foreign id can't reach another property's row even
though there is only one property today. This is precisely PRD §22's "unauthorized ID cannot
mutate another property's record" test, and it is what makes the schema safe to extend to
multiple properties later without a redesign.

### The end-to-end pattern, worked through Rent (the template for Utilities/Expenses/Loans)

1. `/rent?m=2026-09` is a Server Component. On render it calls **`ensureMonthGenerated`**
   (server-only, idempotent): reads active units + last month's `unit_month_records`, computes
   this month's carry-forward occupancy and current rent-version snapshot **in plain TypeScript**
   (consistent with decision 1 — this pure "what should this month look like" function is
   directly unit-testable in Phase 3), then bulk-inserts with `ON CONFLICT DO NOTHING` so
   re-running it never touches an already-entered payment.
2. The page renders a table: one row per unit — code, type, occupancy badge, expected rent,
   paid amount, status badge, payment date, comment.
3. Editing a row opens a small form (Client Component, `react-hook-form` + Zod resolver — the
   `form` UI wrapper is hand-written now, since shadcn's CLI silently skipped it in Phase 1).
4. Submit calls **`saveRentAction`**, a Server Action built on `next-safe-action`: validates
   input shape, converts the rupee string to paise via `parsePaise`/`fromRupees`
   (`src/domain/money.ts` — reused, not reimplemented), confirms the target row belongs to the
   current property via the repository, writes `paid_amount`/`payment_date`/`comment`
   (`status` recomputes itself — it's generated), then `revalidatePath` refreshes the page.
5. Utilities, Expenses, and Loans (Phases 5–6) reuse this exact shape: ensure-month-or-fetch →
   table → per-row form → validated Server Action → revalidate. Rent proves the pattern once,
   under the hardest case (versioned rent, carry-forward occupancy, generated status).

### Storage safety (your "full kit" decision)

- `pnpm db:backup` → `docker compose exec db pg_dump` to a timestamped file under `/backups`
  (already git-ignored).
- `pnpm db:restore <file>` → restores into a running container.
- `pnpm db:export` → all tables to CSV under `/exports`, for a human-readable copy independent
  of Postgres — distinct from the polished in-app CSV export UI, which is Phase 8.
- `pnpm db:seed` (skeleton) / `pnpm db:seed:demo` (12 months) / `pnpm db:reset` (drop + migrate,
  no seed).

### Driver pick

`postgres` (postgres.js) 3.4.9 via `drizzle-orm/postgres-js` — the lighter, commonly-paired
driver for a single local Postgres instance. `pg`/node-postgres was the alternative; either
works, this is a low-stakes pick and easily swapped since Drizzle abstracts the query builder
from the driver.

### Scope of this pass — confirmed

**Full schema (all 11 tables) + a working Rent screen**, this round. Utilities, Expenses, and
Loans keep their existing phases (5–6) and reuse the pattern Rent proves out. Docker Desktop is
confirmed running (`docker info` succeeded).

### This round's verification

1. First action on exiting plan mode: confirm `.env.local` exists (it could not be created for
   you — `.env*` is covered by a permission deny rule); create it from `.env.example` if not.
2. `docker compose up -d` → `munnudi-db` healthy.
3. `pnpm db:migrate` runs clean against a fresh container.
4. `pnpm db:seed` (skeleton) → 6 units, 4 loans, 6 categories exist with zero activity.
5. `pnpm db:reset && pnpm db:seed:demo` → 12 months of plausible history.
6. `pnpm test` — new domain tests for `ensureMonthGenerated`'s pure "next month's census" logic
   (carry-forward occupancy, correct rent-version snapshot, `ON CONFLICT DO NOTHING` never
   clobbers an entered payment).
7. `pnpm dev` → open `/rent?m=2026-09`, enter a paid amount for a unit, confirm it saves,
   `status` recomputes (try an amount below expected → `PARTIAL`, at expected → `PAID`, above →
   `OVERPAID`), and reloading the page shows the saved value.
8. **History-immutability spot check** (decision 4): with two months of demo data, save rent for
   the current month, then check that an _earlier_ month's expected-rent snapshot is unaffected.
9. `pnpm db:backup` → `pnpm db:reset` → `pnpm db:restore` → data returns intact.
10. `pnpm typecheck && pnpm lint && pnpm build` clean.

---

## Build phases

Each phase ends in a working, committed, verifiable state.

**Phase 0 — Plan into repo.** `git init`; copy this document to `docs/IMPLEMENTATION_PLAN.md`;
`.nvmrc` = 24.18.0; `.gitignore`; first commit. _(Your explicit request.)_

**Phase 1 — Foundation.** Next 16 + TS + Tailwind 4 + shadcn; ESLint/Prettier; Vitest; Docker
Compose Postgres 17; `.env.example`; app shell with nav + persistent month selector; INR
formatting **with the ICU snapshot test**.

**Phase 2 — Data layer + Rent vertical slice. COMPLETE.** Drizzle schema for all 11 tables +
migrations; generated columns, partial unique indexes, CHECKs, audit triggers, `v_loan_ledger`;
property-scoping chokepoint; backup/restore/export scripts; skeleton + 12-month demo seed;
`ensureMonthGenerated`, a working `/rent` entry screen, and `saveRentAction` — see "Phase 2,
in detail" above for the design, and the build log below for what verification found.

**Phase 3 — Domain engine + tests.** `src/domain/` and **the PRD §22 suite written first**,
with fixture builders (`aMonth('2025-01').unit('U3', {...}).rentPaid(...)`) so scenarios stay
readable. Correctness is won here, before any UI depends on it.

**Phase 4 — Units & rent.** Unit/rent settings with versioning; census generation with
carry-forward occupancy + "apply forward"; rent entry (Paid/Partial/Unpaid/Overpaid); monthly
checklist driven by `*_reviewed_at`.

**Phase 5 — Utilities & expenses.** Readings with UoM, usage derivation, meter-event handling;
expenses across the six categories with soft delete + restore + confirmation.

**Phase 6 — Loans.** Masters; repayments with interest-only path for the gold loan; adjustments;
`v_loan_ledger` drift surfaced per row.

**Phase 7 — Dashboard.** KPI cards × 3 scopes with three-state Measure rendering and coverage
("10 of 12 months"); prior-month deltas; drilldowns; all 8 charts incl. Unit Collection Matrix;
Vacancy Loss; missing-data flags.

**Phase 8 — Reports, export, QA, deploy.** Monthly statement; annual summary; unit/loan/expense/
utility reports; CSV export; mobile QA; **then** pick a host, add single-user session auth, and
deploy — with free-tier terms verified at that point.

Backfilling your two prior months needs no extra tooling: the month selector reaches any month
from `tracking_start_month`.

---

## Verification

**Automated**

- `pnpm test` — domain units, with **all 12 PRD §22 scenarios named explicitly**, plus the traps
  found in review: average Collection Rate = Σ/Σ (not mean of rates); Till-Now Pending vs summed
  monthly shortfall; missing month excluded from both numerator and denominator; `paid_amount`
  NULL ≠ ₹0; gold-loan interest-only records ₹0 principal; soft-deleted expense leaves totals but
  restores; loan drift localized to the right row; INR renders exactly `₹1,23,456.00`.
- `pnpm test:scoping` — crafted `property_id` cannot read or mutate another property's rows.
- `pnpm typecheck && pnpm lint && pnpm build`.

**Manual**

1. `pnpm db:reset && pnpm db:seed:demo` → 12 months of history.
2. `pnpm dev` → dashboard populates across Current / Till Now / Average.
3. **Reconciliation:** Dashboard totals == Reports totals for the same month and scope (§22, §25).
4. **History-immutability:** change which unit is self-occupied → **prior months do not move**
   (validates decision 4). Repeat by deactivating a unit and by closing a loan.
5. Enter two prior months → averages and Till Now update; coverage counts update.
6. Soft-delete an expense → vanishes from totals, still restorable from History.
7. `pnpm db:backup` → `pnpm db:reset` → `pnpm db:restore` → data returns intact.
8. Mobile viewport: KPI cards → 2 columns, tables scroll horizontally.
9. `pnpm db:reset && pnpm db:seed` → skeleton, ready for real data.

---

## Risks

| Risk                                                           | Mitigation                                                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Free-tier terms unverified** (no web access)                 | Deferred to Phase 8 by choosing local-first; nothing depends on a vendor until then                                                   |
| TypeScript 7 tooling gaps                                      | Fall back to `typescript@^5.9`; surfaces immediately in Phase 1                                                                       |
| Drizzle 0.45 is pre-1.0                                        | Used for schema + typed queries only; generated columns, CHECKs and triggers are raw SQL                                              |
| shadcn's default primitive (Base UI) is an RC                  | Pin stable Radix 1.6.7 in Phase 1; components are copied into the repo, so switching later is contained                               |
| Recharts 3 `defaultProps` behaviour under React 19 unconfirmed | Settled empirically in Phase 1 on the first chart — five-minute check, not a blocker                                                  |
| Local-only Postgres = data lives on one Mac                    | Full backup kit in Phase 2, **before** real data is entered                                                                           |
| Scope: 8 phases is a large build                               | Every phase independently verifiable and committed; stop or re-prioritise at any boundary                                             |
| Deviations from PRD §16/§17/§19                                | All marked **[NEW]/[CHG]** above with rationale; `docs/` will carry a PRD-deviations note so the PRD and code don't silently disagree |

---

## Open items

1. **Sign-up is disabled** — single-user app; auth arrives only in Phase 8, at deploy.
2. **`total_payment` stays user-entered** (read off the lender statement) with a
   `principal + interest + other <= total` CHECK; any remainder is shown as "unallocated ₹X"
   rather than silently absorbed.
3. **Month locking (CLOSED) is optional** and defaults **off** — the section review checkmarks
   give you the checklist without friction. Say so if you'd rather have hard locking on.

---

## Build log — decisions settled empirically during implementation

The plan above was written before any code existed. These are the points where
reality differed from it, and what was done. Recorded so the reasoning is not lost.

### Phase 1 (foundation) — complete

| Planned                        | Actual                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript **7.0.2**           | **5.9.3**              | `typescript-eslint@8.70.0` declares `typescript: ">=4.8.4 <6.1.0"` — TS 7 is explicitly unsupported by the linter. This is exactly the "tooling lags" fallback the plan anticipated. TS 7's only benefit here was compile speed we do not need.                                                                                                                                                      |
| ESLint `^9` (scaffold default) | **`^9` retained**      | `eslint-config-next@16.3.5` declares `eslint: ">=9.0.0"`, so 10 _looks_ supported — but ESLint 10 crashes on `eslint-plugin-react@7.37.5` (a transitive dep): `contextOrFilename.getFilename is not a function`. The declared peer range lied; verified by upgrading and reverting. Note ESLint 9.39.5 is flagged EOL by npm — revisit when `eslint-config-next` ships a 10-compatible plugin chain. |
| shadcn primitives: pin Radix   | **Confirmed and done** | The CLI exposes `-b, --base <base>` taking `base \| radix \| aria`, which confirms the Base UI default shift. Initialised with `-b radix -p nova`; `radix-ui@^1.6.7` (stable) installed rather than `@base-ui-components/react@1.0.0-rc.0`.                                                                                                                                                          |
| Recharts 3.10.1                | **3.8.0**              | Pinned by the shadcn `chart` registry entry. Kept, since it is the version their chart wrapper is tested against.                                                                                                                                                                                                                                                                                    |
| React 19.3.0                   | **19.2.8**             | Pinned by `create-next-app@16.3.5`; the combination Next 16.3.5 was tested with.                                                                                                                                                                                                                                                                                                                     |
| `@types/node ^24`              | **`^22`**              | 22.20.2 is the latest published; no 24.x line exists yet. Harmless — Node 24 runtime is unaffected.                                                                                                                                                                                                                                                                                                  |
| shadcn `form` component        | **Deferred**           | The CLI silently no-ops on `form` in the `radix-nova` style (registry check succeeds, no file written, no error). `react-hook-form` + `@hookform/resolvers` are installed; the thin wrapper will be hand-written in Phase 4 when forms are actually built.                                                                                                                                           |
| `.env.example` committed       | **Not created**        | Blocked by a permission deny rule covering `.env*` in this environment. The required keys are documented in `README.md` instead, and `.env.local` must be created by hand.                                                                                                                                                                                                                           |

**Verified at the end of Phase 1:** `pnpm typecheck`, `pnpm lint`, `pnpm build` all clean;
28 domain tests pass; all 8 routes return 200; the month selector round-trips through the URL;
`?m=2026-07` reaches a past month (backfill path); `?m=2026-13` degrades to the current month
rather than erroring; "current month" resolves correctly in `Asia/Kolkata`.

### Phase 2 (data layer + Rent vertical slice) — complete

Full schema (11 tables), migrations, the property-scoping chokepoint, a working
`/rent` entry screen, and the backup/restore/export kit are built and verified
against a live Postgres 17 container. Five things were settled empirically
rather than by assumption — each is a real bug or false assumption the plan's
design couldn't have caught on paper:

| Planned / assumed                                                                                                               | What actually happened                                                                                                                                                                                                          | Fix                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hand-edit generated migrations for generated columns, partial unique indexes, and CHECKs (Drizzle's DSL support was unverified) | **Drizzle 0.45.2 supports all three natively** — `.generatedAlwaysAs()`, partial `.where()` on `uniqueIndex()`, and `check()` — confirmed by reading the installed type definitions                                             | Declared directly in the TS schema. Hand-written SQL is now needed only for the audit trigger and `v_loan_ledger` view, which are genuinely outside any table-schema DSL |
| `generatedAlwaysAs(sql, { mode: 'stored' })`                                                                                    | The concrete column builder only accepts **one argument** — the `config` param exists on an abstract class not exposed here                                                                                                     | Single-argument call; Postgres only supports STORED pre-v18 anyway, which is the implicit behaviour                                                                      |
| `.onConflictDoNothing({ target: [...] })` would work for census generation                                                      | **Failed at runtime**: `there is no unique or exclusion constraint matching the ON CONFLICT specification`. Postgres requires a partial index's `WHERE` predicate to be named in the `ON CONFLICT` clause, not just its columns | Added `where: isNull(unitMonthRecords.deletedAt)`, matching the index's own predicate exactly                                                                            |
| `pg_dump` (schema+data) → restore into a freshly migrated database                                                              | **Failed**: `relation "unit_month_records" already exists`. `db:reset` already runs migrations, so a full dump collides with the schema that's already there                                                                    | Backups are `--data-only`; schema is _always_ owned by migrations, never by a backup file                                                                                |
| Data-only restore would just work                                                                                               | **Failed again**: `duplicate key value violates unique constraint "__drizzle_migrations_pkey"`. Drizzle's own migration-tracking table lives in a separate `drizzle` schema and got swept into the dump                         | `--exclude-schema=drizzle` on backup; `--disable-triggers` added too, so restoring data doesn't re-fire the audit triggers and double-log the restore itself             |

After both fixes: a full reset → demo-seed → backup → reset → restore cycle
reproduces exact row counts (`unit_month_records` 72, `utility_records` 144,
`expenses` 49, `loan_repayments` 48, `audit_log` 363) and identical data.

**One design clarification found by testing, not a bug:** carrying occupancy
forward from the _prior month's row_ (not from `units.default_occupancy_status`)
means editing that column has no effect after a unit's first-ever census
month — confirmed directly: changing `units.default_occupancy_status` and
regenerating already-existing months left them provably unchanged, and a
brand-new month still carried forward the _old_ occupancy. This is correct
per decision 4, but it means "change which unit is self-occupied" genuinely
requires the dedicated Phase 4 "apply from this month forward" action (writing
directly onto a future month's `occupancy_snapshot`) — editing the unit's
default alone will not do it.

**End-to-end verification performed** (not just typecheck/build):

- Generated columns confirmed live: `is_billable`/`status` computed correctly
  through PARTIAL → PAID → OVERPAID transitions via the exact repository
  function the Server Action calls.
- Cross-property write attempt (crafted `propertyId`) correctly blocked,
  returned `false`, row unchanged — PRD §22's authorization test, against the
  real implementation, not a unit-test double.
- Append-only audit log confirmed: a direct `DELETE FROM audit_log` affected
  **0 rows**; every INSERT/UPDATE across the 4 triggered tables produced
  exactly one audit row (363 = 122 unit_month_records events + 144 + 49 + 48).
- History-immutability confirmed directly (see above).
- `v_loan_ledger`'s SQL-side recurrence (`LAG`-based) independently agreed
  with the demo seed's JS-side amortization loop to the paisa — zero drift
  rows — across 48 loan repayments, including the gold loan's ₹0-principal
  interest-only pattern (PRD §22).
- Rendered `/rent` HTML checked directly (browser MCP tools are misconfigured
  in this environment — both Playwright and chrome-devtools — so verification
  was via server-rendered HTML and direct repository calls, not a live
  browser interaction; this is a real verification gap, noted honestly).

**New file layout:** `src/db/{schema,client,migrate,env,seed,scripts}`,
`src/domain/rent.ts` (+11 tests), `src/server/db/{scope,repositories}`,
`src/server/actions/{client,rent}`, `src/components/rent/*`,
`src/components/ui/form.tsx` (hand-written — the CLI silently skipped it),
`drizzle/{0000_init,0001_audit_and_ledger}.sql`, `docker-compose.yml`
(from Phase 1), `.env.local`/`.env.example` (created via a `cp` workaround —
the Write/Read tools have a deny rule on `.env*` filenames in this
environment; Bash `cp` was unaffected).

---

## Phase 5 (Utilities + Expenses) — complete. Phase 6 (Loans) — in progress, paused

Prompted directly: Utilities/Expenses screens were confirmed still missing, and Loans was
asked to be richer than originally scoped — auto-computed amortization from principal/tenure/
rate, a one-click "mark EMI paid", add/close-loan with history preserved for charts. The full
design (schema addition, new domain modules, the amortization-anchor approach, and the
per-screen repository/action/page breakdown) is recorded in the "Utilities screen" / "Expenses
screen" / "Loans screen" design that was planned for this round — this section records what
was actually built, verified, and what remains, so the work resumes cleanly.

### Done and verified (Utilities + Expenses)

- **Schema**: `loans.remaining_tenure_months` (nullable `integer` + non-negative CHECK) added
  via `drizzle/0002_add_loan_tenure.sql` — a plain column, so unlike Phase 2's generated
  columns this needed **no hand-editing**; `drizzle-kit generate` produced exactly the two
  correct DDL statements on its own.
- **`src/db/schema/loan-ledger-view.ts`**: a typed, read-only Drizzle binding to the hand-written
  `v_loan_ledger` view via `pgView(...).existing()`. Verified empirically that `.existing()`
  does exactly what it should: running `drizzle-kit generate` afterward reported
  **"No schema changes, nothing to migrate"** — Drizzle never tries to CREATE or diff a view
  marked existing, confirmed rather than assumed.
- **`src/domain/loans.ts`**: the standard reducing-balance EMI formula, pure and unit-tested
  (11 tests). Cross-checked against the commonly-cited textbook figure (₹1,00,000 at 10% p.a.
  for 12 months → EMI ≈ ₹8,791.59, computed to the paisa); the full-schedule tests additionally
  confirm total principal across all 12 months equals the original outstanding **exactly** (no
  paisa leaks or double-counts from per-month rounding) and that the final month's principal is
  capped so the closing balance is exactly zero, never negative.
- **`src/domain/utilities.ts`**: `computeUsage` — override wins, missing reading returns `null`
  (never `0`), 4 tests.
- **Utilities screen** (`/utilities`): repository (`listMonthForDisplay` — renders one virtual
  row per active unit × {ELECTRICITY, WATER} even before any DB row exists; `upsertUtilityRecord`),
  `saveUtilityAction`, edit dialog, and the page. **Repeated a Phase 2 lesson correctly on the
  first attempt this time**: the upsert's `onConflictDoUpdate` uses `targetWhere:
  isNull(utilityRecords.deletedAt)` to match the partial unique index's exact predicate — the
  same class of bug that bit `unit_month_records` in Phase 2, avoided here because it was
  called out explicitly in this round's plan before writing the code.
- **Expenses screen** (`/expenses`): repository (list/create/update/soft-delete/restore),
  4 Server Actions, add/edit dialog, delete-with-confirmation (`AlertDialog`, per PRD 15), and a
  "Recently deleted" panel on the same page satisfying PRD 22's recoverability requirement
  ahead of the full History page (Phase 8).
- Both screens smoke-tested against the live demo-seeded database (200 responses, real data
  rendering — Electricity/Water rows, category names, computed totals).
- `pnpm typecheck && pnpm lint && pnpm test` all clean (52 tests passing, 0 warnings) as of this
  pause point.

### Loans — designed and partially built, paused here

**Done:** the schema column, the `v_loan_ledger` typed view binding, the full amortization
engine in `src/domain/loans.ts`, and `src/server/db/repositories/loans.ts` (`listLoans`,
`createLoan`, `updateLoan`, `closeLoan`, `reopenLoan`, and `resolveAmortizationAnchor` — the
function that finds "the latest effective outstanding before this month" from `v_loan_ledger`,
falling back to `openingOutstanding`, and ticks `remainingTenureMonths` down by elapsed months
from `openingAsOfMonth`). All of it typechecks and lints clean.

**Not yet built** (resume here, in this order):
1. `src/server/db/repositories/loan-repayments.ts` — `getForMonth(propertyId, loanId, month)`,
   `upsertRepayment(...)` (same partial-unique-index `targetWhere` pattern as utilities/rent:
   the index is `(loan_id, month) WHERE deleted_at IS NULL`).
2. `src/server/actions/loans.ts` — `createLoanAction`, `updateLoanAction`, `closeLoanAction`,
   `reopenLoanAction`, `saveLoanRepaymentAction` (the shared write path behind both "Mark Paid"
   and manual entry).
3. UI: a loan add/edit dialog (mirrors `ExpenseDialog`'s create-vs-edit pattern), a close-loan
   confirmation (mirrors `DeleteExpenseButton`'s `AlertDialog` pattern, showing current
   outstanding as an FYI, not a hard block), a repayment dialog that is pre-filled from
   `nextExpectedRepayment(...)` when tenure is known and no repayment exists yet for the month
   (with a plain blank manual-entry fallback when tenure is unknown or `expectsMonthlyPayment`
   is false), and the `/loans` page itself: active loans with per-month status, a collapsed
   "Closed loans" section below.
4. Full verification pass per the plan's Loans checklist: edit a seeded demo loan to add
   tenure, confirm the computed EMI is in the right ballpark versus what `demo.ts` already
   computed for it; "Mark Paid" produces a `v_loan_ledger` row with `drift = 0`; add + mark-paid
   + close a brand-new loan and confirm its history survives the close; a crafted foreign loan
   id on `updateLoanAction` fails closed.

**Explicitly still out of scope after Loans is finished**: Dashboard/charts (Phase 7, next
immediately after), the full History page (Phase 8), and the month-close checklist UI — all
as originally scoped, not newly dropped.

---

## Current status — September 2026

### Phases completed

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Plan into repo | ✅ Complete |
| 1 | Foundation (Next.js 16, Tailwind 4, shadcn, Vitest) | ✅ Complete |
| 2 | Data layer + Rent vertical slice | ✅ Complete |
| 5 | Utilities + Expenses screens | ✅ Complete |
| 6 | Loans (CRUD, repayments, amortization, prepayments) | ✅ Complete |
| 7 | Dashboard (KPI cards, charts, scope toggle) | ✅ Complete |
| 8 (partial) | Reports (6 tabs, CSV export) | ✅ Complete |

### Phases not started

| Phase | Scope | Notes |
|-------|-------|-------|
| 3 | Domain engine + PRD §22 test suite | KPI engine (102 tests) covers most of this |
| 4 | Unit/rent settings with versioning, "apply forward" | Settings page still a placeholder |
| 8 (remainder) | History/audit page, mobile QA, deployment | Placeholders remain |

---

## Architecture as built

### File layout

```
src/
├── app/(app)/
│   ├── dashboard/page.tsx        (395 lines) — 10 KPI cards, scope toggle, 8 charts
│   ├── expenses/page.tsx         (159 lines) — expense list with delete/restore
│   ├── loans/
│   │   ├── page.tsx              (373 lines) — card-per-loan layout, KPI strip
│   │   └── [id]/page.tsx         (291 lines) — loan detail: schedule, history, prepay
│   ├── rent/page.tsx             (148 lines) — rent census with delete/restore
│   ├── reports/page.tsx          (400 lines) — 6 tabbed reports + CSV export
│   ├── utilities/page.tsx        (150 lines) — utility grid with delete/restore
│   ├── history/page.tsx          (placeholder)
│   └── settings/page.tsx         (placeholder)
├── components/
│   ├── dashboard/                (12 files) — KPI card, scope toggle, 7 charts, matrix, flags
│   ├── loans/                    (14 files) — loan-card, dialogs, amortization, prepayment
│   ├── reports/                  (11 files) — statement, summary, charts, CSV download
│   ├── expenses/                 (3 files)  — dialog, delete, restore
│   ├── rent/                     (4 files)  — edit dialog, status badge, delete, restore
│   ├── utilities/                (3 files)  — edit dialog, delete, restore
│   └── ui/                       (24 files) — shadcn primitives
├── domain/                       — pure calculation engine, 102 tests
│   ├── kpi.ts                    (837 lines) — 19 functions: KPI computation + chart builders
│   ├── money.ts                  (130 lines) — Paise branded type, INR formatting
│   ├── month.ts                  (128 lines) — MonthKey type, ranges, arithmetic
│   ├── loans.ts                  (97 lines)  — EMI amortization engine
│   ├── rent.ts                   (84 lines)  — census computation
│   └── utilities.ts              (26 lines)  — usage derivation
├── server/
│   ├── actions/                  — 22 server actions across 5 files
│   │   ├── loans.ts              (266 lines) — 9 actions (CRUD + repayment + delete)
│   │   ├── expenses.ts           (108 lines) — 4 actions
│   │   ├── rent.ts               (98 lines)  — 4 actions
│   │   ├── utilities.ts          (98 lines)  — 3 actions
│   │   └── reports.ts            (85 lines)  — CSV export
│   └── db/
│       ├── scope.ts              — property-scoping chokepoint
│       └── repositories/         — 8 repository files
│           ├── loans.ts          (268 lines) — 13 functions + types
│           ├── loan-repayments.ts(270 lines) — 11 functions + types
│           ├── utility-records.ts(267 lines) — 7 functions + types
│           ├── unit-month-records.ts (241 lines) — 7 functions + types
│           ├── expenses.ts       (158 lines) — 8 functions + types
│           ├── monthly-status.ts (31 lines)  — 1 function
│           ├── unit-rent-versions.ts (20 lines)
│           └── units.ts          (19 lines)
├── db/schema/                    — 13 files, 12 tables + 1 view
└── lib/                          — 7 utility files
```

### Database schema (4 migrations)

| Migration | Purpose |
|-----------|---------|
| `0000_init.sql` | All 11 tables, generated columns, partial unique indexes, CHECKs |
| `0001_audit_and_ledger.sql` | Audit trigger function + `v_loan_ledger` view |
| `0002_add_loan_tenure.sql` | `remaining_tenure_months` on loans |
| `0003_hesitant_ken_ellis.sql` | `deleted_at` on loans (soft-delete support) |

### Key architectural patterns

**1. Pure calculation engine** (`src/domain/kpi.ts`): 19 functions, no DB imports. Dashboard
and Reports call the same functions, so totals match by construction. Uses a three-state
`Measure` type (`value | partial | unknown`) with `basisMonths` for coverage display.

**2. Scope toggle**: URL param `?scope=current|tillNow|average`. Server Component re-renders
with scope-appropriate data. Charts always show trailing 12 months regardless of scope.

**3. Card-per-loan layout**: Each loan gets an expandable Card with 3 tabs (Schedule,
Payments, Prepayments). Dropdown menu for all actions. KPI strip at top shows portfolio
totals. Prepayment dialog with optional remaining-balance override and EMI impact preview.

**4. Soft-delete everywhere**: All 5 entity types (expenses, loan repayments, rent, utilities,
loan masters) support soft-delete with `deletedAt` + restore. AlertDialog confirmation on
delete, "Recently deleted" panels with restore buttons. Unique constraint conflict checks
on restore.

**5. Property scoping**: Every action calls `getActivePropertyId()`. Every repo function takes
`propertyId` as first arg. Write operations filter by `propertyId` in WHERE. No entity ID
from client input is trusted without property verification.

**6. Partial unique indexes**: All upserts on tables with `WHERE deleted_at IS NULL` indexes
include `targetWhere: isNull(table.deletedAt)` — a lesson learned in Phase 2 and applied
consistently.

### Dashboard: 10 KPI cards + 8 charts

**KPI cards** (with scope: Current / Till Now / Average):
1. Rental Target  2. Rent Collected  3. Rent Pending  4. Collection Rate
5. Maintenance Paid  6. Operating Profit  7. Principal Repaid  8. Interest Paid
9. Outstanding Principal (stock — no average)  10. Total Debt Payments

**Charts**: Rent Expected vs Collected (clustered bar), Expenses by Category (stacked bar),
Loan Balance Trend (multi-line), Principal vs Interest (stacked column), Operating Profit
Trend (bar with zero line), Unit Collection Matrix (HTML table), Electricity Trend (line),
Water Trend (line).

### Reports: 6 tabs + CSV export

Monthly Statement | Annual Summary | Unit Performance | Loan Report | Expense Report |
Utility Report. Year picker uses Indian FY (April–March). CSV export via server action +
Blob download.

### Delete/restore capability matrix

| Entity | Schema `deletedAt` | Soft-delete | Restore | Conflict check on restore |
|--------|:---:|:---:|:---:|:---:|
| Expenses | ✅ | ✅ | ✅ | N/A (no unique index) |
| Loan Repayments | ✅ | ✅ | ✅ | ✅ (loanId + month) |
| Rent Entries | ✅ | ✅ | ✅ | ✅ (unitId + month) |
| Utility Records | ✅ | ✅ | ✅ | ✅ (unitId + month + type) |
| Loan Masters | ✅ | ✅ | ✅ | Repayment guard (delete repayments first) |

### Validation alignment (Zod ↔ DB CHECKs)

| Constraint | Zod (client) | Zod (server) | DB CHECK |
|------------|:---:|:---:|:---:|
| `total_payment > 0` | ✅ | ✅ | ✅ |
| `expense amount > 0` | ✅ | ✅ | ✅ |
| `parts ≤ total` | — | ✅ (action body) | ✅ |
| `adjustment needs reason` | — | ✅ (`\|\|` not `??`) | ✅ |
| `current ≥ previous (meter)` | — | ✅ (`.refine()`) | ✅ |

### Test coverage

102 tests across 6 domain modules. Key scenarios tested:
- Collection rate uses Σ/Σ not mean (54.5% not 75%)
- NULL paidAmount ≠ ₹0
- Zero target → null rate (no divide-by-zero)
- Rent pending floors per-month
- Outstanding is a stock (no average)
- Self-occupied excluded from target
- Gold loan ₹0 principal is valid
- Chart series includes all months

---

## What remains to build

### P0 — Must-have before real daily use

| Item | Effort | Schema change? |
|------|--------|:---:|
| **Settings page** — edit property, units, rent, categories, policy toggles | M | No |
| **Month close checklist UI** — surface the 4 `*_reviewed_at` timestamps | S | No |
| **Rent "Apply Forward"** — propagate occupancy/rent changes to future months | M | No |
| **History/audit page** — surface the audit_log table | M | No |

### P1 — High value

| Item | Effort | Schema change? |
|------|--------|:---:|
| Tenant name + phone on units | S | 2 columns |
| Cumulative rent arrears per unit | S | No |
| Net yield / ROI calculator | S | 1 column (`purchasePrice`) |
| Loan-free date projection | S | No |
| Backup reminder banner | S | No |

### P2 — Nice-to-have

| Item | Effort | Schema change? |
|------|--------|:---:|
| Recurring expenses (auto-generate monthly) | M | 1 column |
| Tax summary tab (Section 24, ITR) | S | No |
| Vacancy Loss KPI | S | No |
| Rent escalation scheduling | M | New table |
| What-if prepayment calculator | S | No |

### Known technical debt

- `getLoanLedger` and `listCurrentOutstandings` exported from both `loans.ts` and
  `loan-repayments.ts` — consolidate to `loans.ts`
- `next-themes` script tag warning in React 19 (cosmetic, does not block rendering)
- No tests for `buildLoanBalanceSeries` and `buildUtilityTrendSeries` chart builders
- Progress bar uses `totalPayment` sum in some places instead of `principalPaid` sum
  (may overstate progress for loans with high interest proportion)
