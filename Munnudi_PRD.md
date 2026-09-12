# MUNNUDI

## Rental Property & Loan Tracker

## Table of Contents
- [10. Loan Management](#10.-loan-management)
- [11. Financial Calculation Rules](#11.-financial-calculation-rules)
- [12. Monthly Close Lifecycle](#12.-monthly-close-lifecycle)
- [13. Reports & Analysis](#13.-reports-and-analysis)
- [14. Notifications & Flags](#14.-notifications-and-flags)
- [15. UX / Design Requirements](#15.-ux---design-requirements)
- [16. Recommended Technical Architecture](#16.-recommended-technical-architecture)
- [17. Database Schema (Build Specification)](#17.-database-schema-(build-specification))
- [18. Application Operations / API Contract](#18.-application-operations---api-contract)
- [19. Security & Privacy Requirements](#19.-security-and-privacy-requirements)
- [20. MVP Acceptance Criteria](#20.-mvp-acceptance-criteria)
- [21. Suggested Build Plan for a Coding Agent](#21.-suggested-build-plan-for-a-coding-agent)
- [22. Critical Test Scenarios](#22.-critical-test-scenarios)
- [23. Post-MVP Enhancements](#23.-post-mvp-enhancements)
- [24. Initial Seed Data for Munnudi](#24.-initial-seed-data-for-munnudi)
- [25. Definition of Done](#25.-definition-of-done)
- [26. Ready-to-Use Coding Agent Brief](#26.-ready-to-use-coding-agent-brief)


## Product Requirements Document (PRD)

| Document status <br> Build-ready PRD • Version 1.0 • September 2026 <br> Primary implementation target: Next.js web app with Supabase Postgres/Auth, deployable on Vercel. |
| --- |


| Item | Decision / Definition |
| --- | --- |
| Product | Munnudi — personal rental-property and loan tracker |
| Primary user | Single owner / household administrator |
| Property model | 1 property → 6 units → 5 rentable by default + 1 self-occupied |
| Units | 4 × 2BHK + 2 × 1BHK |
| Loans | 4 loans: 3 home loans + 1 gold loan |
| Accounting grain | Monthly, with optional transaction date for audit/history |
| Currency | INR (₹), configurable later |
| Deployment goal | Free/low-cost personal deployment |
| MVP stack | Next.js 16.x + TypeScript + Tailwind/shadcn-style UI + Supabase Postgres/Auth + Vercel |

1. Executive Summary

Munnudi is a lightweight personal finance application for managing one multi-unit rental property. It combines unit-level rent tracking, monthly utility readings, property expenses, loan repayments, and a dashboard that explains whether the property is generating positive rental cash flow and how much debt has been repaid.

The product is intentionally designed around a monthly operating cycle: configure property/unit/loan masters once, then record each month’s rent, water, electricity, expenses, and loan repayments. The dashboard derives cumulative, monthly-average, and current-month KPIs from those records.

| Product principle <br> Record once, calculate everywhere. Users should never need to manually recompute monthly totals, outstanding loan balance, rent target, collection rate, or historical averages. |
| --- |

2. Product Goals & Non-Goals

### 2.1 Goals

Provide a single source of truth for rent, property expenses, utility usage/bills, and loan repayments.

Track all 6 units while clearly distinguishing self-occupied and rentable units.

Make the monthly closing workflow fast enough to complete in a few minutes.

Show cumulative and monthly-average financial metrics without spreadsheets.

Provide charts for rent collection, expenses, loan repayment, utilities, and operating profit.

Preserve an auditable history so corrections do not silently destroy prior data.

Run securely as a personal web app on free tiers.

### 2.2 Non-goals for MVP

Full accounting / double-entry bookkeeping.

Tenant CRM, rent agreements, legal notices, or lease document management.

Online payment collection or automatic bank statement reconciliation.

Tax filing / GST / income-tax computation.

Multi-property household budgeting outside this property.

3. Primary User & Core Jobs

| Job | Desired outcome |
| --- | --- |
| Monthly rent close | See expected rent vs collected rent and identify unpaid units immediately. |
| Utility close | Enter electricity/water bills/readings for each unit and preserve month-level history. |
| Expense capture | Log common/property expenses with optional comments and category. |
| Loan close | Record each loan repayment and see principal/interest/remaining balance. |
| Financial review | Understand rent collected, maintenance spent, profit, debt repayment, and trend over time. |
| Data correction | Edit or reverse a monthly entry without corrupting cumulative numbers. |

4. Key Product Decisions

Unit 1 is not inherently “self occupied”; occupancy status is a property setting that can change over time. Seed one unit as self-occupied for MVP based on current context.

Expected rent is configurable per unit and versioned by effective month. Historical months retain the rent that was applicable when they occurred.

Self-occupied units are excluded from “Rental Target” and “Collection Rate” by default. A setting may optionally include them for an “Economic Rent / Opportunity Cost” view later.

“Rental Operating Profit” means Rent Collected minus selected operating/property expenses. The default MVP profit view follows the requested definition: Rent Collected − Maintenance Expenses. A separate “Net Property Cash Flow” view can subtract all operating expenses and loan payments.

Loan “remaining” means outstanding principal balance, not total future EMI cash outflow. Interest remaining may be estimated later but is not the primary debt KPI.

Month is the reporting period. Every rent, utility, expense, and repayment record must belong to exactly one calendar month.

5. Information Architecture

| Area | Purpose | MVP pages |
| --- | --- | --- |
| Dashboard | Portfolio health and trend summary | Dashboard |
| Rent | Unit-by-unit expected/paid rent | Rent |
| Utilities | Electricity & water readings/bills | Utilities |
| Expenses | Property/common expenses | Expenses |
| Loans | Loan masters, monthly repayments, balances | Loans |
| Reports | Historical analysis and charts | Reports |
| Setup | Property, units, rent, loan configuration | Settings |
| Audit / history | Corrections and activity | History (lightweight MVP) |

6. Dashboard Requirements

The dashboard is the home screen. It must support a month selector and a KPI scope toggle: “Current Month”, “Till Now”, and “Monthly Average”. “Till Now” means from the first recorded month through the selected report month.

### 6.1 KPI cards

| KPI | Definition | Scope options |
| --- | --- | --- |
| Rental Target | Sum of expected rent for rentable/active units in the month | Current / Till now / Average |
| Rent Collected | Sum of rent payments marked paid/received | Current / Till now / Average |
| Rent Pending | Rental Target − Rent Collected, floored at 0 for the month | Current / Till now / Average |
| Collection Rate | Rent Collected ÷ Rental Target × 100 | Current / Till now / Average |
| Maintenance Paid | Expenses tagged Maintenance | Current / Till now / Average |
| Rental Operating Profit | Rent Collected − Maintenance Paid (default requested metric) | Current / Till now / Average |
| Loan Principal Repaid | Principal component recorded across all loan repayments | Current / Till now / Average |
| Loan Interest Paid | Interest component recorded across repayments | Current / Till now / Average |
| Outstanding Principal | Current balance across all active loans | Current / Till now |
| Total Debt Payments | Principal + interest payments recorded | Current / Till now / Average |


### 6.2 Dashboard charts

12-month Rent: Expected vs Collected — clustered bars or lines.

12-month Expenses by Category — stacked bars.

Loan Balance Trend — line chart for total outstanding principal; optionally one line per loan.

Principal vs Interest Paid — stacked columns by month.

Operating Profit Trend — monthly bar/line chart.

Unit Collection Matrix — heatmap-like table showing Paid / Pending / Self Occupied by month.

Electricity Usage Trend — kWh by unit and total where readings exist.

Water Usage Trend — litres/kL by unit and total where readings exist.

### 6.3 Dashboard UX

All cards show a small comparison to prior month when enough history exists.

Clicking a KPI drills into the underlying records.

Missing data is explicit: “Not entered” is different from ₹0.

The dashboard should never silently assume a missing bill/payment was zero.

Mobile layout: KPI cards collapse to 2 columns; tables become horizontally scrollable.

7. Property & Unit Management

| Field | Required | Rules |
| --- | --- | --- |
| Unit name/number | Yes | Unique within property |
| Type | Yes | 2BHK / 1BHK |
| Occupancy status | Yes | Self Occupied / Vacant / Occupied |
| Current expected rent | Yes for rentable units | INR >= 0 |
| Rent effective from | Yes | First day of a month |
| Tenant label | No | Display-only label, not full CRM |
| Active | Yes | Inactive units excluded from future targets |

Seed configuration: 6 units total: four 2BHK and two 1BHK. One unit is seeded as self-occupied, leaving five rentable units in the initial rental target. The UI must allow the owner to change which unit is self-occupied later.

### 7.1 Rent workflow

Create/open a month.

Automatically create rent obligations for all active rentable units using the applicable monthly rent.

Allow the user to adjust the rent amount for the month before marking payment.

Allow partial payment only if explicitly enabled in settings; MVP default is full-month paid/pending.

Mark rent as Paid, Pending, or Partially Paid. Record payment date and optional comment.

Display unit-level expected, paid, balance, and status.

Allow rent changes for future months without rewriting historical records.

8. Electricity & Water Tracking

Utilities are monthly, unit-level records. Bills can be recorded even when meter readings are unavailable.

| Field | Electricity | Water |
| --- | --- | --- |
| Unit | Required | Required |
| Month | Required | Required |
| Previous reading | Optional | Optional |
| Current reading | Optional | Optional |
| Usage | Derived or manual | Derived or manual |
| Bill amount | Optional | Optional |
| Bill paid | Optional yes/no | Optional yes/no |
| Comment | Optional | Optional |

Usage derivation: current reading − previous reading when both are numeric. Negative usage is blocked unless the user explicitly records a meter reset/rollover flag. Units may be configured as kWh for electricity and litres/kL for water; the app must not hard-code a universal unit conversion.

9. Expense Management

| Category | Examples | MVP behavior |
| --- | --- | --- |
| Common Electricity | Common-area electricity | Monthly amount + comment |
| Electrical Maintenance | Repairs, fixtures | Monthly amount + comment |
| Water | Common water supply / tanker | Monthly amount + comment |
| Plumbing | Leaks, pipe repairs | Monthly amount + comment |
| Cleaning | Common-area cleaning | Monthly amount + comment |
| Miscellaneous | Other property expenses | Monthly amount + comment |

Expense record: month, category, amount, date, comment, optional unit allocation, optional receipt/reference.

Allow a single expense to be common/property-wide or allocated to a unit later; allocation is optional in MVP.

Category totals feed dashboard charts.

Edits and deletions require confirmation; deleted records should be soft-deleted for auditability.

## 10. Loan Management

MVP supports exactly four initial loans, but the data model should support arbitrary loan count so future changes do not require schema redesign.

| Loan master field | Description |
| --- | --- |
| Loan name | Human-friendly name, e.g. Home Loan 1 |
| Loan type | Home Loan / Gold Loan / Other |
| Lender | Optional display name |
| Original principal | Initial sanctioned/borrowed amount |
| Opening outstanding | Outstanding principal at tracker start |
| Interest rate | Annual percentage rate, optional |
| Scheduled EMI | Expected monthly payment |
| Tenure / end date | Optional |
| Active | Yes/no |


### 10.1 Monthly repayment record

| Field | Rule |
| --- | --- |
| Month | Required |
| Payment date | Required or defaulted to month-end |
| Total payment | > 0 |
| Principal paid | >= 0 |
| Interest paid | >= 0 |
| Other charges | Optional |
| Outstanding after payment | Required for balance tracking |
| Comment | Optional |

For the gold loan, the UI must support interest-only repayments without forcing a principal component. For home loans, principal and interest may be entered separately. The app should validate that Principal + Interest + Other Charges does not exceed Total Payment unless an explicit “reconciliation adjustment” mode is used later.

## 11. Financial Calculation Rules

| Metric | Formula / rule |
| --- | --- |
| Monthly Rental Target | SUM(expected rent of active rentable units for month) |
| Monthly Rent Collected | SUM(paid amount across rent records for month) |
| Monthly Rent Pending | MAX(Rental Target − Rent Collected, 0) |
| Collection Rate | IF(Rental Target = 0, null, Rent Collected / Rental Target × 100) |
| Maintenance Paid | SUM(expenses where category = Maintenance; category should support a canonical maintenance flag) |
| Rental Operating Profit | Rent Collected − Maintenance Paid |
| Total Operating Expenses | SUM(all non-loan property expenses) |
| Net Property Cash Flow | Rent Collected − Total Operating Expenses − Total Debt Payments |
| Principal Repaid | SUM(principal component of loan repayments) |
| Outstanding Principal | SUM(latest valid outstanding principal across active loans) |
| Till-now average | Cumulative metric ÷ number of reporting months with applicable records; do not count months before tracker start |
| Average monthly rent collection | Total rent collected ÷ number of rent months |
| Unit rent balance | Expected unit rent − paid unit rent |


| Important semantic distinction <br> Do not label Rent − Maintenance as “true profit” in accounting terms. The UI may use “Rental Operating Profit” as the requested KPI and separately show “Net Property Cash Flow” after all expenses and loan payments. |
| --- |


## 12. Monthly Close Lifecycle

OPEN — Month is created automatically on first use.

RENT — Rent obligations are generated from unit rent configurations.

UTILITIES — Enter electricity/water readings and bills as available.

EXPENSES — Enter common/property expenses.

LOANS — Enter each loan’s monthly repayment.

REVIEW — Dashboard recalculates KPIs and flags missing expected records.

CLOSED (optional MVP+) — Lock the month against accidental edits; unlock requires explicit action.

A monthly checklist should show incomplete data, e.g. “2 of 5 rentable rents paid”, “electricity bill missing”, or “Loan 3 repayment not entered”.

## 13. Reports & Analysis

Monthly statement view with all rent, expenses, utilities, and loan repayments.

Annual summary: rent target, collected rent, expenses, operating profit, principal repaid, interest paid.

Unit performance: rent collected by unit, collection consistency, vacancy/self-occupancy history.

Loan report: opening principal, principal repaid, interest paid, outstanding principal, repayment trend.

Expense report: category/month breakdown and top categories.

Utility report: usage and bill trends by unit.

### 13.1 Export

MVP should support CSV export of rent, expenses, utilities, and loans. PDF reporting is optional post-MVP.

## 14. Notifications & Flags

Unpaid rent for the selected month.

Loan repayment missing for selected month.

Expected utility bill/reading missing.

Negative meter usage or suspiciously large month-over-month usage.

Outstanding rent balance > 0.

Loan outstanding balance increased unexpectedly.

MVP uses in-app flags only. Email/WhatsApp/SMS reminders should be deferred until the core tracker is stable and hosting economics are understood.

## 15. UX / Design Requirements

Clean, modern financial-dashboard aesthetic; prioritize numbers and comparison over decoration.

Use a persistent month selector in the app shell.

Use consistent status badges: Paid, Pending, Partial, Self Occupied, Vacant, Missing.

Use Indian currency formatting (₹1,23,456) throughout.

Forms should support keyboard entry and sensible defaults.

Every destructive action requires confirmation.

Empty states must explain what to enter next rather than showing blank charts.

Desktop-first but fully responsive for phone use.

## 16. Recommended Technical Architecture

| Recommendation <br> Use Next.js + TypeScript for the full-stack application, Supabase PostgreSQL for persistent storage and authentication, and Vercel for deployment. This keeps the stack small, modern, and inexpensive for a personal application. |
| --- |


| Layer | Recommendation | Reason |
| --- | --- | --- |
| Web framework | Next.js 16.x + TypeScript | React-based, strong server/client split, deploys naturally to Vercel. |
| UI | Tailwind CSS + accessible component primitives | Fast consistent styling and responsive layout. |
| Charts | Recharts (or equivalent lightweight chart library) | Enough for dashboard time-series and bars without a complex BI layer. |
| Database | Supabase PostgreSQL | Relational model fits units, monthly records, and loans; free tier provides 500 MB database/project. |
| Auth | Supabase Auth | Use email/password or magic link; protect all user data with RLS. |
| Server data access | Next.js Server Actions / Route Handlers + Supabase server client | Keeps secrets server-side and supports validated mutations. |
| Hosting | Vercel Hobby | Natural Next.js deployment and Git-based CI/CD; free for personal/non-commercial use. |
| Version control | GitHub | Primary source and deployment trigger. |


### 16.1 Why not add a separate backend?

Do not introduce Express/NestJS, a dedicated VPS, Redis, or a separate API service for MVP. Munnudi has low write volume and simple relational workflows. Next.js server-side operations plus Supabase are sufficient and materially reduce operational complexity.

### 16.2 Hosting caveat

The current free tiers are suitable for a personal MVP, but quotas and eligibility can change. Vercel describes Hobby as a free plan for personal/non-commercial use; Supabase’s current free plan includes a 500 MB Postgres database, with projects that pause after one week of inactivity. Re-check plan terms at deployment time.

## 17. Database Schema (Build Specification)

| Table | Key fields |
| --- | --- |
| profiles | id, email, display_name, created_at |
| properties | id, owner_id, name, currency, timezone, created_at |
| units | id, property_id, unit_code, unit_type, occupancy_status, active, created_at |
| unit_rent_versions | id, unit_id, effective_month, expected_rent, created_at |
| rent_records | id, unit_id, month, expected_rent_snapshot, paid_amount, status, payment_date, comment, created_at, updated_at |
| utility_records | id, unit_id, month, utility_type, previous_reading, current_reading, usage, bill_amount, paid, comment |
| expense_categories | id, property_id, name, is_maintenance, active |
| expenses | id, property_id, unit_id nullable, month, expense_date, category_id, amount, comment, deleted_at |
| loans | id, property_id, name, loan_type, lender, original_principal, opening_outstanding, interest_rate, scheduled_emi, active |
| loan_repayments | id, loan_id, month, payment_date, total_payment, principal_paid, interest_paid, other_charges, outstanding_after_payment, comment |
| monthly_status | id, property_id, month, state, closed_at, closed_by |
| audit_log | id, user_id, entity_type, entity_id, action, before_json, after_json, created_at |


### 17.1 Data integrity constraints

All tenant/property records carry owner_id through property relationship; RLS must prevent cross-user access.

Unique constraint: one rent record per unit per month.

Unique constraint: one utility record per unit + month + utility_type.

Loan repayment uniqueness: one repayment per loan per month for MVP; support adjustment records later.

Use numeric/decimal SQL types for INR and meter readings; never use floating-point for money.

Soft-delete expenses and auditable mutations where practical.

Indexes on property_id, month, unit_id, loan_id, and active status.

## 18. Application Operations / API Contract

| Operation | Input | Result |
| --- | --- | --- |
| getDashboard(month, scope) | month, scope | KPIs + chart series + missing-data flags |
| saveRent(month, unitId, amount, status, date, comment) | rent payload | Upsert rent record |
| saveUtility(month, unitId, type, readings, bill, paid, comment) | utility payload | Upsert utility record + derived usage |
| createExpense(...) | expense payload | Created expense ID |
| updateExpense(id, ...) | expense payload | Updated expense |
| saveLoanRepayment(...) | loan + repayment payload | Repayment saved + balance validation |
| getLoanSummary() | property ID | Per-loan and total balances |
| getMonthlyStatement(month) | month | Normalized monthly ledger |
| exportCsv(dataset, range) | dataset + date range | CSV download |

Prefer typed server functions over a broad CRUD REST API in MVP. Add public API routes only where an external integration genuinely needs them.

## 19. Security & Privacy Requirements

Authentication is mandatory for production deployment.

Use Supabase Row Level Security so a user can only access rows belonging to their property.

Never expose the Supabase service-role key to browser code.

Validate every monetary amount and month server-side.

Protect mutation actions against unauthorized property IDs.

Use HTTPS in deployment.

Provide an account/data export function before adding any destructive “delete all” operation.

No payment card, bank credential, or sensitive financial-account login information is stored in Munnudi MVP.

## 20. MVP Acceptance Criteria

User can sign in and see only their property data.

App supports 6 units with 4 2BHK + 2 1BHK, with one unit seeded as self-occupied.

Self-occupied unit is excluded from rental target by default.

User can configure rent per unit and change future rent without rewriting history.

For a month, user can mark rent paid and see collected, pending, and collection rate.

User can record electricity and water readings/bills per unit.

User can record common expenses with the six requested categories and optional comments.

User can maintain 4 loans and record monthly principal/interest repayments.

Dashboard shows current-month, till-now, and monthly-average metrics.

Dashboard contains at least five useful charts: rent, expenses, operating profit, loan balance, repayment mix.

Calculations are derived from database records and are consistent across Dashboard and Reports.

CSV export works for all major datasets.

Application is responsive and usable on desktop and mobile.

No critical data-access or authorization vulnerability remains before deployment.

## 21. Suggested Build Plan for a Coding Agent

Phase 1 — Foundation: Initialize Next.js + TypeScript; configure Tailwind/UI primitives; create Supabase project; environment variables; auth; database migrations; RLS; app shell/navigation.

Phase 2 — Property/Units: Property setup, unit master, occupancy status, rent versioning, seed data for 6 units.

Phase 3 — Rent: Monthly rent page, payment status, pending/paid calculations, monthly close checklist.

Phase 4 — Utilities & Expenses: Electricity/water forms, usage calculation, expense category management, comments, soft delete.

Phase 5 — Loans: Loan setup, monthly repayments, principal/interest split, outstanding balance tracking.

Phase 6 — Dashboard: KPI engine, current/till-now/average selector, charts, missing-data flags, drilldowns.

Phase 7 — Reports/Export: Monthly statement, annual summary, CSV exports, audit/history polish.

Phase 8 — QA/Deploy: Unit/integration tests, RLS verification, edge cases, mobile QA, Vercel deployment, backup/export validation.

## 22. Critical Test Scenarios

Self-occupied unit does not increase rental target or reduce collection rate.

Rent increase effective July changes July onward only; January–June historical rent remains unchanged.

Partial rent does not show as fully paid.

Zero rent target does not create divide-by-zero collection-rate errors.

Missing electricity reading is not shown as 0 kWh.

Meter reset can be represented without negative usage corruption.

Gold-loan interest-only payment records ₹0 principal correctly.

Loan outstanding balance reconciles with opening outstanding minus principal repayments plus adjustments.

Deleted expense disappears from current totals but remains recoverable/auditable.

Unauthorized user cannot query or mutate another property’s records via crafted IDs.

Monthly average ignores months before tracker start and does not treat missing records as zero unless explicitly defined.

Dashboard and report totals match for the same month and scope.

## 23. Post-MVP Enhancements

Tenant details and lease dates.

Rent escalation schedules and auto-generated future rent.

Payment reminders / email notifications.

Receipt upload and OCR.

Bank statement import / transaction matching.

Automatic EMI schedule generation using amortization formulas.

Opportunity-cost rent for self-occupied unit.

Multiple properties.

PWA/mobile install and offline-first month entry.

PDF annual report and tax-oriented expense classification.

## 24. Initial Seed Data for Munnudi

| Entity | Seed |
| --- | --- |
| Property | 1 property named “Munnudi Property” |
| Units | 6 total: Unit 1–4 = 2BHK; Unit 5–6 = 1BHK (codes editable) |
| Occupancy | One unit = Self Occupied; five units = Occupied/Vacant as configured |
| Expense categories | Common Electricity, Electrical Maintenance, Water, Plumbing, Cleaning, Miscellaneous |
| Loans | Home Loan 1, Home Loan 2, Home Loan 3, Gold Loan |
| Currency | INR |
| Default reporting | Current month selected; dashboard opens to current month |


## 25. Definition of Done

All MVP acceptance criteria pass.

Database migrations are reproducible from a clean environment.

RLS tests confirm user isolation.

No money is represented as floating-point in the database.

Dashboard totals reconcile to source records for multiple historical months.

Application can be built and deployed from a Git repository without local-only dependencies.

CSV export and data recovery workflow are documented.

No production secret is committed to Git.

## 26. Ready-to-Use Coding Agent Brief

| Implementation instruction <br> Build Munnudi as a production-quality personal web application using Next.js 16.x, TypeScript, Tailwind CSS, and Supabase PostgreSQL/Auth. Follow this PRD as the source of truth. Start with schema/migrations and RLS, then application shell, property/units, rent, utilities, expenses, loans, dashboard, reports, export, and tests. Prefer server-side validated mutations, typed domain functions, decimal money types, month-based unique constraints, auditable changes, and responsive UX. Do not add unnecessary backend services. Optimize for simplicity, correctness, and maintainability on a free-tier deployment. |
| --- |

Technology-plan references checked September 2026: Vercel Pricing; Supabase Pricing/Billing; Next.js release notes.