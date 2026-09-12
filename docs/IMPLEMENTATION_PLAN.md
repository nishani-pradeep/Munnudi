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

## Build phases

Each phase ends in a working, committed, verifiable state.

**Phase 0 — Plan into repo.** `git init`; copy this document to `docs/IMPLEMENTATION_PLAN.md`;
`.nvmrc` = 24.18.0; `.gitignore`; first commit. _(Your explicit request.)_

**Phase 1 — Foundation.** Next 16 + TS + Tailwind 4 + shadcn; ESLint/Prettier; Vitest; Docker
Compose Postgres 17; `.env.example`; app shell with nav + persistent month selector; INR
formatting **with the ICU snapshot test**.

**Phase 2 — Data layer.** Drizzle schema + migrations; generated columns, partial unique
indexes, CHECKs, audit triggers, `v_loan_ledger`; property-scoping chokepoint; **backup/restore/
export scripts**; realistic 12-month demo seed + skeleton seed + reset.

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
