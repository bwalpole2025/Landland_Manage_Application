# Security & Privacy Review Checklist

This checklist tracks PropManage against the project's security & privacy
requirements. Each item links to where it is enforced.

## Access control & tenant isolation

- [x] **Tenant isolation on every query.** All business data is scoped to an
      account derived from the session, never from the client. Enforced in the
      tRPC layer via `accountProcedure` (`src/server/trpc.ts`), which injects
      `ctx.accountId` from the session. Defense-in-depth: Postgres row-level
      security policies (`prisma/rls.sql`) filter every tenant table to
      `app.current_account_id`.
- [x] **Role-based access (owner / assistant / accountant).** Capabilities are
      modelled in `can()` (`src/server/auth/session.ts`); sensitive routers use
      `ownerOnly` middleware (team, billing, settings, notifications, privacy).
      MTD submission honours delegated accountant ("as agent") context.
- [x] **No client-trusted identifiers.** Account/user ids always come from the
      validated session cookie, not request input.

## Secrets & data at rest

- [x] **Encryption at rest for sensitive data.** AES-256-GCM envelope encryption
      (`src/server/security/encryption.ts`), keyed by `ENCRYPTION_KEY`. Applied
      to TOTP 2FA secrets (`src/server/auth/twofactor.ts`) and HMRC OAuth tokens
      (`src/server/mtd/token-store.ts`). Self-describing `enc:`/`plain:` format
      supports rotation.
- [x] **Provider token flows — no stored passwords/secrets.** Banking uses the
      provider's OAuth/consent flow (`BankFeedProvider`); HMRC MTD uses OAuth
      (`src/server/mtd/`). No Government Gateway credentials are ever stored.
- [x] **No raw card data.** Card billing uses the provider's hosted checkout
      (`src/server/providers/payments.ts`); we store only a display summary
      (brand + last 4), never the PAN/CVC.
- [x] **Passwords hashed** with bcrypt; **session tokens** stored only as SHA-256
      hashes (`src/server/auth/session.ts`, `tokens.ts`).

## Session & transport

- [x] **Hardened session cookie:** `httpOnly`, `sameSite=lax`, `secure` in
      production, 30-day TTL (`setSessionCookie`, `src/server/auth/session.ts`).
- [x] **2FA (TOTP)** available with an encrypted secret and a verified-code
      enrolment handshake.

## Auditability

- [x] **Audit log for financial changes & external submissions.** Append-only
      `AuditLog` model; `recordAudit()` (`src/server/security/audit.ts`) is wired
      into HMRC MTD submissions (`src/server/mtd/service.ts`), bank-feed imports
      (`src/server/jobs/processors/feed-poll.ts`), and subscription changes
      (`src/server/billing/service.ts`). Viewable in Settings → Activity log.

## Privacy / GDPR

- [x] **Data export (right of access/portability).** Owner-gated JSON export of
      all account data at `GET /api/privacy/export`
      (`src/server/security/gdpr.ts`); secrets (password hashes, 2FA secrets) are
      redacted.
- [x] **Account deletion (right to erasure).** Owner-gated, name-confirmed,
      cascading delete via `privacy.deleteAccount`
      (`src/server/routers/privacy.ts`); audited before removal.
- [x] **Privacy-first cookie consent.** Consent banner defaults to nothing
      non-essential until an explicit choice (`src/components/privacy/CookieConsent.tsx`).
      Only strictly-necessary cookies (session, UI state) are used.

## Delivery

- [x] **CI runs migrations, seeding, lint, typecheck, unit + E2E tests, build.**
      (`.github/workflows/ci.yml`).
- [x] **Preview environment.** Per-PR Vercel preview deploys
      (`.github/workflows/deploy-preview.yml`, `vercel.json`); container image
      for other targets (`Dockerfile`, `output: "standalone"`).

## Operational notes

- `ENCRYPTION_KEY` MUST be set in production (sourced from a KMS/secrets
  manager). Without it, sensitive values fall back to tagged plaintext (dev/CI
  only) and a warning is logged.
- The MTD token store is an in-memory reference implementation; the same
  encrypted `enc:`/`plain:` format applies when swapped for a persistent store.
