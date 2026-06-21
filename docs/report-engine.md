# Report engine — calculation rules & shared infrastructure

All eleven reports run through one engine so their figures are **consistent by
construction**. This document specifies the shared infrastructure and the
per-report calculation rules.

## Shared infrastructure

### Reporting service
`runReport(request)` ([src/server/reports/service.ts](../src/server/reports/service.ts))
is the single server entry point. It accepts:

```ts
{
  reportType: string,
  dateRange: { from, to },
  portfolioId?: string,
  propertyId?: string,
  ownerId?: string,
  page?: number, pageSize?: number   // pagination for large ledgers
}
```

and returns a typed `ReportModel` (sections of typed columns + rows + totals)
plus optional `pagination`. It assembles a serialisable `ReportDataset` once
(via `buildDataset()`) and delegates to the **pure builders**
([src/lib/reports/build.ts](../src/lib/reports/build.ts)), which also run in the
browser for instant filtering.

### Typed model & formatting
Every report reduces to `ReportModel`
([src/lib/reports/model.ts](../src/lib/reports/model.ts)). Cells carry **raw
values** (money = integer pence, dates = ISO) and a column `type`; `formatCell`
renders them per output:

- **Money** — GBP, grouped, negatives in parentheses (`formatGBP`). One formatter, everywhere.
- **Dates / times** — presented in the **account time zone** (`account.timeZone`,
  e.g. `Europe/London`) via `formatDateTimeInTimeZone`. Every report carries a
  `Generated` meta stamped in that zone.
- **Pagination** — the service paginates the primary section; the UI paginates
  large ledgers client-side (`PAGE_SIZE = 15`).

### Export adapters
[src/app/api/reports/export/route.ts](../src/app/api/reports/export/route.ts):

- **CSV** — streamed line-by-line from `reportToCsvLines` (a generator) through a
  `ReadableStream`, so large ledgers never buffer in full.
- **PDF** — rendered server-side by `reportToPdf` (a dependency-free, paginated
  PDF) and returned as `application/pdf`.

Both are gated on the session and respect every filter via query params.

### Canonical calculations
[src/lib/reports/totals.ts](../src/lib/reports/totals.ts) is the single source of
truth for period totals — the dashboard **and** the reports call it:

- `directionTotals(rows)` — income − expenses by direction, **excluding
  deactivated** rows. Raw cash view.
- `operatingPnl(rows)` — categorised income − allowable operating expenses only;
  **excludes** debt service (finance costs / mortgage capital) and capital expenditure.

## Per-report rules

| Report | Rule |
| --- | --- |
| **Annual Report** | `directionTotals` over the period; per-property P&L + expenses by category. |
| **Directors' Loans** | Aggregated **by company and director** from company-linked loan movements; net = advances − repayments. |
| **General Ledger** | All transactions (incl. deactivated), income & expense columns, totals. |
| **Hammock Tax Statement** | Mirrors the **tax engine** (`estimateTax`) output and the **SA105** layout (income boxes, allowable expenses, finance-cost reducer, estimated tax). |
| **Income Statement (P&L)** | `operatingPnl` — **excludes** debt service and capital expenditure. |
| **Monthly Cashflow** | **All** movements per calendar month — including personal and transfers. |
| **Net Cashflow** | All categories, income/expense/net (incl. finance & capital). |
| **Rent Received** | Rent income **dated by rent due date**, not bank date. |
| **Rent Roll** | All tenancies & details (portfolio filter, no date). |
| **Tenant Ledger** | Reconciles **expected vs received** per tenant to surface **missed** payments. |
| **Tracked Transactions** | Categorised, active transactions with tax treatment. |

## Reconciliation guarantee

Because the dashboard and the reports share `totals.ts` and `tax.ts`:

- **Annual Report** P&L totals == dashboard P&L (`getYtdTotals`) for the same period.
- **Income Statement** == `operatingPnl` for the same period.
- **Hammock Tax Statement** == Tax module (`estimateTax`); owner-filtered ==
  per-owner Tax module (`estimateTaxForOwner`).

These equalities are enforced by tests in `test/smoke.test.ts` (the `reports`
suite).

## Filters

- **portfolioId** — a transaction's portfolio is its property's portfolio
  (unassigned → default portfolio).
- **propertyId** — restrict to one property.
- **ownerId** — apportion every property transaction by the owner's share,
  identical to the Tax module's per-owner pro-rata, so figures reconcile.
