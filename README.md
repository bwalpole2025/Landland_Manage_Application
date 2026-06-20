# Landland

A landlord finance & property management SaaS (MTD for IT ready), modelled on Hammock.
Track rental income and expenses, monitor arrears, store compliance documents, estimate
tax against the UK SA105 pages, and submit Making Tax Digital quarterly updates to HMRC.

See [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) for the product brief.

## Stack

| Concern | Choice |
| --- | --- |
| Frontend | Next.js 14 (App Router) + React + TypeScript + Tailwind |
| Server state / forms | TanStack Query · React Hook Form + Zod |
| API | **tRPC** (end-to-end typed) via Next route handlers |
| Database | **PostgreSQL** + **Prisma**; money as integer minor units (pence) + ISO currency |
| Auth | DB-backed **session cookies** (bcrypt), email verification, password reset, optional **TOTP 2FA** |
| Background jobs | **BullMQ** + Redis (reminders, arrears detection, feed polling) |
| File storage | S3-compatible **DocumentStorage** (mock / MinIO / S3) |

## Quick start

```bash
# 1. Infrastructure (Postgres + Redis + MinIO)
docker compose up -d

# 2. Install, apply migrations, seed the demo account
npm install
cp .env.example .env          # defaults already match docker-compose
npm run db:migrate            # apply Prisma migrations (prisma migrate deploy)
npm run db:seed               # seed demo account + data

# 3. Run
npm run dev                   # http://localhost:3000
npm run worker                # (optional) background jobs — needs REDIS_URL
```

> Schema changes: edit `prisma/schema.prisma`, then `npm run db:migrate:dev -- --name <change>`
> to create + apply a migration. `npm run db:reset` rebuilds the DB from migrations and re-seeds.

**Demo login:** `demo@landland.app` / `Password123!` (pre-filled on the sign-in page).

`/` → `/login` → `/dashboard` (protected). Unauthenticated requests to any `(app)`
route redirect to `/login`.

### Scripts

```
npm run dev | build | start          # Next.js
npm run lint | typecheck | test      # CI gates
npm run storybook | build-storybook  # design-system explorer
npm run db:migrate | db:seed | db:reset | db:studio | db:generate
npm run worker                       # BullMQ worker
```

## Design system

A shared design system lives in [src/components/ds/](src/components/ds/) and is documented
in **Storybook** (`npm run storybook`, or `npm run build-storybook` for a static explorer).

- **Tokens** (Tailwind): **brand** = vivid purple/indigo (logo, active nav, primary buttons),
  **accent** = teal/cyan (secondary actions), **semantic** success / warning / danger, slate
  neutrals, `rounded-pill` buttons + `rounded-card`/`shadow-card`, Poppins geometric sans.
- **Components**: Button (primary/secondary/outline/ghost), Card, **MetricCard** (uppercase
  label + large value), Tabs, DataTable (with filters), Modal, Banner/Alert (incl. trial),
  Select, SearchInput, Breadcrumb, SidebarNavItem, and a **Coachmark** with a `useCoachmark`
  "don't show again" first-visit pattern (localStorage-backed).

Retokening `brand` recolours every screen at once, since the app shell and existing
components are built on the same `brand-*` tokens.

## Architecture

```
prisma/
  schema.prisma     # multi-tenant model: accountId everywhere, audit + soft-delete
  migrations/       # versioned SQL migrations (prisma migrate)
  seed.ts           # idempotent demo account + data
  rls.sql           # optional Postgres row-level-security policies
src/
  app/
    login/                      # RHF + Zod sign-in
    (app)/                      # protected shell (layout guards the session)
      dashboard/                # "hello dashboard" — greets the seeded user, DB-backed stats
      properties|transactions|tax|mtd|files|reports/
    api/
      trpc/[trpc]/route.ts      # tRPC fetch handler
      auth/login|logout/route.ts
  server/
    db.ts                       # Prisma singleton
    env.ts                      # env config
    context.ts / trpc.ts        # tRPC context + procedure hierarchy
    routers/                    # auth, account, dashboard
    auth/                       # password, session, tokens, totp, service
    providers/                  # BankFeedProvider, HmrcMtdProvider, DocumentStorage, Mailer (+ mocks)
    jobs/                       # BullMQ queue, worker, processors
  components/  lib/             # design system + domain utilities
```

### Core data model

```
Account 1─* Portfolio 1─* Property *─* BeneficialOwner   (join carries ownership %)
Portfolio *─1 Company (optional)        Account 1─* User 1─* Membership (invited to other accounts)
```

- **Account** — top-level tenant: subscription/trial state, `firstTaxYear`, `timeZone`, currency, marketing/notification prefs, MTD enrolment.
- **User** — `firstName`/`lastName`, email + `emailVerified`, mobile + `mobileVerified`, `passwordHash`, `twoFactorEnabled`, `role` (owner/assistant/accountant), `numberOfPropertiesManaged`. Belongs to a home Account; `Membership` grants access to other accounts.
- **Portfolio** — `personal`/`business`; exactly one default per account (`Personal — Default`). Untracked transactions (no property) carry the default portfolio.
- **Company** — optional limited company linked to a business portfolio (directors' loan balance, company tax).
- **BeneficialOwner** — individual or company owning a share; `PropertyBeneficialOwner` carries `ownershipPercentage` (Decimal) for pro-rata tax.
- **Property** — address, portfolio, rental income + frequency, valuation, purchase price, street-view camera position, EPC data, archive flag; **Mortgage** (LTV) and **Valuation** history hang off it.
- **Tenancy** — primary tenant name/email, rent + frequency, deposit, start/end (null = ongoing), next payment date, status, and arrears/credit state (`balanceState` + signed `balanceMinor`).
- **Transaction** — optional property/tenancy, `rentDueDate`, amount (pence), direction, category/subcategory, notes, receipt document, source (bank_feed/manual/import), `reconciled` + `deactivated` flags.
- **Document** — file ref + `category`, optional property/tenancy, expiry, reminders. **Note** (property/tenant), **Reminder** (due date + open/completed), **TaxStatement** (portfolio/owner scope, computed income/expenses/estimate).

Money is integer minor units (`*Minor`, pence) + ISO-4217 `currency`; interest rates are integer basis points. Derived figures (annual yield, loan-to-value) are computed in [src/lib/finance.ts](src/lib/finance.ts). All entities carry `accountId`.

### Multi-tenancy

Every business record carries `accountId`. Isolation is enforced in the API layer:
`accountProcedure` (in [src/server/trpc.ts](src/server/trpc.ts)) derives `accountId`
from the **session**, never from client input, so a query can only ever read its own
account's rows. [prisma/rls.sql](prisma/rls.sql) adds Postgres row-level-security
policies as defense-in-depth. The smoke test asserts one account cannot see another's data.

### Deferred integrations (service interfaces + mocks)

`BankFeedProvider`, `HmrcMtdProvider`, `DocumentStorage`, and `Mailer` are interfaces
with mock implementations selected by env in
[src/server/providers/index.ts](src/server/providers/index.ts). No application code
imports a concrete provider — swapping a mock for TrueLayer / the HMRC client / S3 /
SES is a one-line change there.

### Conventions

- **Money** is integer **minor units** (pence) + an ISO-4217 `currency`; never floats.
- **Audit**: every model has `createdAt`/`updatedAt`. **Soft-delete/archive**
  (`deletedAt`/`archivedAt`) on `Property` and `Tenancy`.
- **Auth**: the session cookie holds an opaque token; only its SHA-256 hash is stored.

## CI

[.github/workflows/ci.yml](.github/workflows/ci.yml) spins up Postgres, applies the
schema, seeds the demo account, then runs **lint → typecheck → smoke test → build**.

The smoke test ([test/smoke.test.ts](test/smoke.test.ts)) covers money/TOTP/password
units (always) plus DB-backed checks (gated on `DATABASE_URL`): the seeded demo account
logs in, bad credentials are rejected, `dashboard.summary` is account-scoped, and tenant
isolation holds.

## Notes / next steps

- The `(app)` feature screens (properties, transactions, tax, MTD, files, reports) render
  a seeded **demo dataset** ([src/services/repository.ts](src/services/repository.ts))
  while the **auth, account, and dashboard** paths are fully DB-backed via tRPC/Prisma.
  Migrating the remaining screens to tRPC queries is the natural next step.
- Production should replace `db push` with Prisma **migrations**, and the security
  advisories from `npm audit` (Next/dev-tooling) tracked for a Next 15/16 upgrade.
```
