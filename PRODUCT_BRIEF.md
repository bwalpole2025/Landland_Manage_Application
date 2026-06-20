# Product Brief — Landland

> A landlord finance & property management SaaS, modelled on Hammock.
> _Status: first build (scaffold). Last updated: 2026-06-20._

## 1. One-liner

Landland helps UK landlords replace spreadsheets by automatically tracking rental
income and expenses, monitoring arrears, storing compliance documents, estimating
tax, and submitting **Making Tax Digital for Income Tax (MTD for IT)** updates to HMRC.

## 2. The problem

Landlords run their finances in fragile spreadsheets and shoeboxes of receipts.
They lose track of which rent has arrived, miss expiring safety certificates, and
scramble at year-end to work out what they owe. From April 2026, MTD for IT requires
many landlords to keep **digital records** and submit **quarterly updates** to HMRC —
spreadsheets alone will no longer be compliant.

## 3. Target users

| Persona | Needs |
| --- | --- |
| **Individual landlord** (1–few properties) | Simple, guided setup; "is my rent in?"; a year-end tax number. |
| **Portfolio / Ltd-company landlord** (multiple owners/shareholders) | Per-property P&L, ownership splits, consolidated reporting, multi-user access. |
| **Accountant / assistant** | **Delegated access** to a client's account, scoped permissions, export & filing. |

## 4. Core value propositions (encoded in the UI)

1. **Goodbye to spreadsheets** — an onboarding checklist that walks the user through
   _add a property → add a tenancy → track a rental transaction_.
2. **Real-time bank feeds** — transactions flow in automatically; **missing-rent
   alerts** and an **arrears** view surface tenants who are behind.
3. **Tax estimates** aligned to the UK **SA105** property pages, always shown with a
   prominent **"This is an estimate, not tax advice"** disclaimer.
4. **Compliance** — store certificates & documents (gas, EICR, EPC, insurance, etc.)
   with **expiry reminders at 30 / 14 / 7 / 1 days** before.
5. **MTD readiness** — keep digital records and **submit quarterly updates** to HMRC.

## 5. Scope for the first build

Build order (matches this scaffold):

1. **Authenticated app shell** — mock auth, account/property switcher, sidebar nav.
2. **Dashboard** — onboarding checklist, key metrics, arrears & compliance alerts.
3. **My Properties** — list + detail (tenancies, ownership, documents).
4. **Transactions** — bank-feed ledger, categorisation, reconcile to expected rent.
5. **Tax** — SA105-aligned estimate with disclaimer.
6. **MTD** — quarterly obligation periods + submit (mock).
7. **Files & Dates** — compliance document vault with expiry reminders.
8. **Reports** — income/expense and per-property P&L.

### Deliberately deferred (behind clean interfaces)

Real **bank-feed** (Open Banking) and **HMRC MTD** integrations are deferred behind
service interfaces (`BankFeedService`, `HmrcService`) with **mock implementations**,
so every screen can be built, demoed, and tested without live credentials. Swapping in
a real provider (e.g. TrueLayer/Plaid, HMRC sandbox) is a single adapter change.

## 6. Key domain model

`Account` → `User`/`Membership` (roles: owner, member, accountant) → `Property` →
`Tenancy` → `Tenant`; `Transaction` (income/expense, categorised to SA105 boxes);
`ComplianceDocument` (type + expiry); `TaxEstimate`; `MtdObligation` / `MtdSubmission`.

## 7. Non-goals for v1

Payments/rent collection, tenant-facing portal, listings/marketing, accounting
double-entry, and live integrations (mocked). Multi-currency — GBP only.

## 8. Tech choices

Next.js (App Router) · TypeScript · Tailwind CSS. Server-agnostic service layer with
mock adapters; in-memory mock data store for the scaffold. No database wired yet — the
repository interfaces are the seam where Postgres/Prisma will land.

## 9. Compliance & trust posture

- Tax figures are **estimates, not advice** — disclaimer shown wherever a number appears.
- MTD submissions are **explicit, reviewable, and logged** before sending.
- Money is stored in **integer pence**; currency is GBP; dates are UK tax-year aware
  (6 April – 5 April).
