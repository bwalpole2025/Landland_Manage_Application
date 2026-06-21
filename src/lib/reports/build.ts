// The report catalogue and the pure builders behind it. Every builder takes a
// serialisable ReportDataset + filters and returns a ReportModel — no repository
// access — so the same code runs on the server and in the browser (for instant
// filtering and client-side export) and is trivially unit-testable.

import type {
  Transaction,
  Property,
  Portfolio,
  Company,
  Tenancy,
  User,
  DirectorLoanMovement,
} from "@/lib/types";
import { CATEGORY_META, categoryLabel } from "@/lib/sa105";
import { estimateTax } from "@/lib/tax";
import { formatDateTimeInTimeZone } from "@/lib/dates";
import { directionTotals, operatingPnl } from "./totals";
import type { ReportModel, ReportRow, ReportColumn } from "./model";

export interface ReportDataset {
  transactions: Transaction[];
  properties: Property[];
  portfolios: Portfolio[];
  companies: Company[];
  tenancies: Tenancy[];
  users: User[];
  directorLoans: DirectorLoanMovement[];
  taxYear: string;
  today: string;
  /** IANA time zone for presenting dates/times. */
  timeZone: string;
  /** When the report was generated (ISO instant). */
  generatedAt: string;
}

export interface ReportFilters {
  from: string;
  to: string;
  /** "" = all portfolios. */
  portfolioId: string;
  /** Restrict to a single property. */
  propertyId?: string;
  /** Apportion figures to a beneficial owner's pro-rata share. */
  ownerId?: string;
}

/** Mirror of ownership.apportionTransactionsForOwner — kept pure for the client. */
function apportionForOwner(transactions: Transaction[], properties: Property[], ownerId: string): Transaction[] {
  return transactions.flatMap((t) => {
    if (!t.propertyId) return [];
    const share = properties.find((p) => p.id === t.propertyId)?.ownership.find((o) => o.userId === ownerId)?.share ?? 0;
    if (share <= 0) return [];
    return [{ ...t, amountPence: Math.round((t.amountPence * share) / 100) }];
  });
}

export type FilterKind = "date" | "portfolio";

export interface ReportDef {
  id: string;
  name: string;
  description: string;
  filters: FilterKind[];
}

export const REPORT_DEFS: ReportDef[] = [
  { id: "annual", name: "Annual Report", description: "Overview for a portfolio and tax year.", filters: ["date", "portfolio"] },
  { id: "directors-loans", name: "Directors' Loans", description: "All directors' loans by Company and Director.", filters: ["date", "portfolio"] },
  { id: "general-ledger", name: "General Ledger", description: "All transactions, income and expenses.", filters: ["date", "portfolio"] },
  { id: "hammock-tax", name: "Hammock Tax Statement", description: "Taxable income and allowable expenses in line with SA105.", filters: ["date", "portfolio"] },
  { id: "income-statement", name: "Income Statement (P&L)", description: "Income and expenses by category, before debt service and capital expenses.", filters: ["date", "portfolio"] },
  { id: "monthly-cashflow", name: "Monthly Cashflow Statement", description: "All payments made/received per calendar month (includes personal and transfers).", filters: ["date", "portfolio"] },
  { id: "net-cashflow", name: "Net Cashflow", description: "Income and expenses by category.", filters: ["date", "portfolio"] },
  { id: "rent-received", name: "Rent Received", description: "Rent received by tenants for a date range, dated by rent due date.", filters: ["date", "portfolio"] },
  { id: "rent-roll", name: "Rent Roll", description: "List of all tenants and tenancy details.", filters: ["portfolio"] },
  { id: "tenant-ledger", name: "Tenant Ledger", description: "All payments and missed payments per tenant.", filters: ["date", "portfolio"] },
  { id: "tracked-transactions", name: "Tracked Transactions", description: "View and filter all tracked transactions.", filters: ["date", "portfolio"] },
];

// --- lookups & helpers ------------------------------------------------------

function buildCtx(d: ReportDataset) {
  const propById = new Map(d.properties.map((p) => [p.id, p]));
  const portfolioById = new Map(d.portfolios.map((p) => [p.id, p]));
  const companyById = new Map(d.companies.map((c) => [c.id, c]));
  const userById = new Map(d.users.map((u) => [u.id, u]));
  const tenancyById = new Map(d.tenancies.map((t) => [t.id, t]));
  const defaultPortfolioId = d.portfolios.find((p) => p.isDefault)?.id ?? d.portfolios[0]?.id ?? "";
  const portfolioOf = (t: Transaction): string =>
    (t.propertyId ? propById.get(t.propertyId)?.portfolioId : undefined) ?? defaultPortfolioId;
  return { propById, portfolioById, companyById, userById, tenancyById, defaultPortfolioId, portfolioOf };
}
type Ctx = ReturnType<typeof buildCtx>;

const inRange = (date: string, f: ReportFilters) => date >= f.from && date <= f.to;

/** Transactions within the date range + portfolio + property (includes deactivated). */
function scope(d: ReportDataset, ctx: Ctx, f: ReportFilters, dateOf: (t: Transaction) => string = (t) => t.date) {
  return d.transactions.filter(
    (t) =>
      inRange(dateOf(t), f) &&
      (!f.portfolioId || ctx.portfolioOf(t) === f.portfolioId) &&
      (!f.propertyId || t.propertyId === f.propertyId),
  );
}

const propName = (ctx: Ctx, t: Transaction) => (t.propertyId ? ctx.propById.get(t.propertyId)?.nickname ?? "—" : "Unassigned");
const tenantNames = (ten?: Tenancy) => (ten ? ten.tenants.map((x) => x.name).join(", ") : "");
const sum = (rows: { amountPence: number }[]) => rows.reduce((s, r) => s + r.amountPence, 0);

function portfolioLabel(d: ReportDataset, f: ReportFilters): string {
  return f.portfolioId ? d.portfolios.find((p) => p.id === f.portfolioId)?.name ?? "—" : "All portfolios";
}
function baseMeta(d: ReportDataset, f: ReportFilters, withDate = true) {
  const meta = [{ label: "Portfolio", value: portfolioLabel(d, f) }];
  if (withDate) meta.unshift({ label: "Period", value: `${f.from} to ${f.to}` });
  if (f.propertyId) meta.push({ label: "Property", value: d.properties.find((p) => p.id === f.propertyId)?.nickname ?? f.propertyId });
  if (f.ownerId) meta.push({ label: "Owner (pro-rata)", value: d.users.find((u) => u.id === f.ownerId)?.name ?? f.ownerId });
  return meta;
}

// --- builders ---------------------------------------------------------------

function buildAnnual(d: ReportDataset, ctx: Ctx, f: ReportFilters): ReportModel {
  const scoped = scope(d, ctx, f);
  // Shared canonical P&L — reconciles with the dashboard P&L for the same period.
  const { incomePence: income, expensesPence: expenses, netPence } = directionTotals(scoped);

  const props = f.portfolioId ? d.properties.filter((p) => p.portfolioId === f.portfolioId) : d.properties;
  const pnlRows: ReportRow[] = props.map((p) => {
    const t = directionTotals(scoped.filter((tx) => tx.propertyId === p.id));
    return { property: p.nickname, income: t.incomePence, expenses: t.expensesPence, net: t.netPence };
  });

  const byCat = groupByCategory(scoped.filter((t) => !t.deactivated && t.direction === "expense"));

  return {
    id: "annual",
    title: "Annual Report",
    subtitle: `Portfolio overview · tax year ${d.taxYear}`,
    meta: baseMeta(d, f),
    sections: [
      {
        title: "Summary",
        columns: [col("metric", "Metric", "text"), col("amount", "Amount", "money")],
        rows: [
          { metric: "Total income", amount: income },
          { metric: "Total expenses", amount: expenses },
          { metric: "Net profit", amount: netPence },
        ],
      },
      {
        title: "Profit & loss by property",
        columns: [col("property", "Property", "text"), col("income", "Income", "money"), col("expenses", "Expenses", "money"), col("net", "Net", "money")],
        rows: pnlRows,
        totals: { property: "Total", income, expenses, net: netPence },
        empty: "No properties in this portfolio.",
      },
      {
        title: "Expenses by category",
        columns: [col("category", "Category", "text"), col("amount", "Amount", "money")],
        rows: byCat,
        totals: { category: "Total", amount: sum(byCat.map((r) => ({ amountPence: Number(r.amount) }))) },
        empty: "No expenses in this period.",
      },
    ],
  };
}

function buildDirectorsLoans(d: ReportDataset, ctx: Ctx, f: ReportFilters): ReportModel {
  const filterCompanyId = f.portfolioId ? ctx.portfolioById.get(f.portfolioId)?.companyId : undefined;
  const companies = d.companies.filter((c) => !filterCompanyId || c.id === filterCompanyId);

  const sections = companies.map((c) => {
    const moves = d.directorLoans
      .filter((m) => m.companyId === c.id && inRange(m.date, f))
      .sort((a, b) => (a.directorUserId + a.date < b.directorUserId + b.date ? -1 : 1));
    const rows: ReportRow[] = moves.map((m) => ({
      director: ctx.userById.get(m.directorUserId)?.name ?? m.directorUserId,
      date: m.date,
      type: m.direction === "advance" ? "Advance" : "Repayment",
      amount: m.direction === "advance" ? m.amountPence : -m.amountPence,
    }));
    const net = rows.reduce((s, r) => s + Number(r.amount), 0);
    return {
      title: `${c.name}${c.companyNumber ? ` (${c.companyNumber})` : ""}`,
      columns: [col("director", "Director", "text"), col("date", "Date", "date"), col("type", "Movement", "text"), col("amount", "Amount", "money")],
      rows,
      totals: { director: "Net outstanding", amount: net },
      empty: "No directors' loan movements in this period.",
    };
  });

  return {
    id: "directors-loans",
    title: "Directors' Loans",
    subtitle: "Directors' loan movements by company and director",
    meta: baseMeta(d, f),
    sections: sections.length ? sections : [{ columns: [col("note", "Note", "text")], rows: [], empty: "No company portfolios in scope." }],
  };
}

function buildGeneralLedger(d: ReportDataset, ctx: Ctx, f: ReportFilters): ReportModel {
  const rows = scope(d, ctx, f).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const incomeTotal = sum(rows.filter((t) => t.direction === "income"));
  const expenseTotal = sum(rows.filter((t) => t.direction === "expense"));
  return {
    id: "general-ledger",
    title: "General Ledger",
    subtitle: "All transactions, income and expenses",
    meta: baseMeta(d, f),
    sections: [
      {
        columns: [
          col("date", "Date", "date"), col("property", "Property", "text"), col("description", "Description", "text"),
          col("category", "Category", "text"), col("income", "Income", "money"), col("expense", "Expense", "money"),
        ],
        rows: rows.map((t) => ({
          date: t.date,
          property: propName(ctx, t),
          description: t.description,
          category: t.category ? categoryLabel(t.category) : "Uncategorised",
          income: t.direction === "income" ? t.amountPence : null,
          expense: t.direction === "expense" ? t.amountPence : null,
        })),
        totals: { date: "Total", income: incomeTotal, expense: expenseTotal },
        empty: "No transactions in this period.",
      },
    ],
  };
}

function buildHammock(d: ReportDataset, ctx: Ctx, f: ReportFilters): ReportModel {
  const tx = f.portfolioId ? d.transactions.filter((t) => ctx.portfolioOf(t) === f.portfolioId) : d.transactions;
  const est = estimateTax(tx, d.taxYear);
  const incomeRows: ReportRow[] = [
    { item: "Rents received (box 20)", amount: est.income.rentsReceivedPence },
    { item: "Lease premiums (box 22)", amount: est.income.premiumsPence },
    { item: "Other property income (box 20)", amount: est.income.otherIncomePence },
  ];
  return {
    id: "hammock-tax",
    title: "Hammock Tax Statement",
    subtitle: `Taxable income and allowable expenses (SA105) · ${d.taxYear}`,
    meta: [{ label: "Tax year", value: d.taxYear }, { label: "Portfolio", value: portfolioLabel(d, f) }],
    sections: [
      {
        title: "Income",
        columns: [col("item", "Item", "text"), col("amount", "Amount", "money")],
        rows: incomeRows,
        totals: { item: "Total income", amount: est.totalIncomePence },
      },
      {
        title: "Allowable expenses",
        columns: [col("item", "Item", "text"), col("amount", "Amount", "money")],
        rows: est.allowableExpenses.map((e) => ({ item: `${e.label} (box ${e.sa105Box})`, amount: e.amountPence })),
        totals: { item: "Total allowable expenses", amount: est.totalIncomePence - est.taxableProfitPence },
        empty: "No allowable expenses recorded.",
      },
      {
        title: "Tax position",
        columns: [col("item", "Item", "text"), col("amount", "Amount", "money")],
        rows: [
          { item: "Taxable rental profit", amount: est.taxableProfitPence },
          { item: "Residential finance costs (box 44)", amount: est.financeCostsPence },
          { item: "Finance-cost tax reducer", amount: -est.financeReliefPence },
          { item: "Estimated tax", amount: est.estimatedTaxPence },
        ],
      },
    ],
  };
}

function buildIncomeStatement(d: ReportDataset, ctx: Ctx, f: ReportFilters): ReportModel {
  const rows = scope(d, ctx, f).filter((t) => !t.deactivated && t.category);
  const incomeCats = groupByCategory(rows.filter((t) => t.direction === "income"));
  // Operating expenses exclude debt service (finance costs) and capital.
  const opExRows = rows.filter(
    (t) => t.direction === "expense" && t.category && CATEGORY_META[t.category].treatment === "allowable_expense",
  );
  const expenseCats = groupByCategory(opExRows);
  // Totals come from the shared operatingPnl so the report reconciles by construction.
  const { incomePence: incomeTotal, expensesPence: expenseTotal, netPence } = operatingPnl(scope(d, ctx, f));
  return {
    id: "income-statement",
    title: "Income Statement (P&L)",
    subtitle: "Income and expenses by category, before debt service and capital expenses",
    meta: baseMeta(d, f),
    sections: [
      { title: "Income", columns: catCols(), rows: incomeCats, totals: { category: "Total income", amount: incomeTotal }, empty: "No income in this period." },
      { title: "Operating expenses", columns: catCols(), rows: expenseCats, totals: { category: "Total expenses", amount: expenseTotal }, empty: "No operating expenses in this period." },
      { title: "Result", columns: catCols(), rows: [{ category: "Net operating profit", amount: netPence }] },
    ],
  };
}

function buildMonthlyCashflow(d: ReportDataset, ctx: Ctx, f: ReportFilters): ReportModel {
  const rows = scope(d, ctx, f); // includes deactivated/personal/transfers — actual cash
  const byMonth = new Map<string, { in: number; out: number }>();
  for (const t of rows) {
    const ym = t.date.slice(0, 7);
    const m = byMonth.get(ym) ?? { in: 0, out: 0 };
    if (t.direction === "income") m.in += t.amountPence;
    else m.out += t.amountPence;
    byMonth.set(ym, m);
  }
  const monthRows: ReportRow[] = [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([ym, m]) => ({ month: monthLabel(ym), moneyIn: m.in, moneyOut: m.out, net: m.in - m.out }));
  const totalIn = monthRows.reduce((s, r) => s + Number(r.moneyIn), 0);
  const totalOut = monthRows.reduce((s, r) => s + Number(r.moneyOut), 0);
  return {
    id: "monthly-cashflow",
    title: "Monthly Cashflow Statement",
    subtitle: "All payments made and received per calendar month",
    meta: baseMeta(d, f),
    sections: [
      {
        columns: [col("month", "Month", "text"), col("moneyIn", "Money in", "money"), col("moneyOut", "Money out", "money"), col("net", "Net", "money")],
        rows: monthRows,
        totals: { month: "Total", moneyIn: totalIn, moneyOut: totalOut, net: totalIn - totalOut },
        empty: "No payments in this period.",
      },
    ],
  };
}

function buildNetCashflow(d: ReportDataset, ctx: Ctx, f: ReportFilters): ReportModel {
  const rows = scope(d, ctx, f).filter((t) => !t.deactivated);
  const cats = new Map<string, { in: number; out: number }>();
  for (const t of rows) {
    const key = t.category ? categoryLabel(t.category) : "Uncategorised";
    const c = cats.get(key) ?? { in: 0, out: 0 };
    if (t.direction === "income") c.in += t.amountPence;
    else c.out += t.amountPence;
    cats.set(key, c);
  }
  const catRows: ReportRow[] = [...cats.entries()]
    .map(([category, c]) => ({ category, income: c.in, expense: c.out, net: c.in - c.out }))
    .sort((a, b) => Number(b.net) - Number(a.net));
  const tIn = catRows.reduce((s, r) => s + Number(r.income), 0);
  const tOut = catRows.reduce((s, r) => s + Number(r.expense), 0);
  return {
    id: "net-cashflow",
    title: "Net Cashflow",
    subtitle: "Income and expenses by category",
    meta: baseMeta(d, f),
    sections: [
      {
        columns: [col("category", "Category", "text"), col("income", "Income", "money"), col("expense", "Expense", "money"), col("net", "Net", "money")],
        rows: catRows,
        totals: { category: "Total", income: tIn, expense: tOut, net: tIn - tOut },
        empty: "No cashflow in this period.",
      },
    ],
  };
}

function buildRentReceived(d: ReportDataset, ctx: Ctx, f: ReportFilters): ReportModel {
  const dueDate = (t: Transaction) => t.rentDueDate ?? t.date;
  const rows = scope(d, ctx, f, dueDate)
    .filter((t) => t.direction === "income" && t.category === "rent" && !t.deactivated)
    .sort((a, b) => (dueDate(a) < dueDate(b) ? -1 : 1));
  const data: ReportRow[] = rows.map((t) => {
    const ten = t.tenancyId ? ctx.tenancyById.get(t.tenancyId) : t.propertyId ? d.tenancies.find((x) => x.propertyId === t.propertyId) : undefined;
    return { dueDate: dueDate(t), property: propName(ctx, t), tenant: tenantNames(ten), amount: t.amountPence };
  });
  return {
    id: "rent-received",
    title: "Rent Received",
    subtitle: "Rent received by tenants, dated by rent due date",
    meta: baseMeta(d, f),
    sections: [
      {
        columns: [col("dueDate", "Due date", "date"), col("property", "Property", "text"), col("tenant", "Tenant", "text"), col("amount", "Rent received", "money")],
        rows: data,
        totals: { dueDate: "Total", amount: sum(rows.map((t) => ({ amountPence: t.amountPence }))) },
        empty: "No rent received in this period.",
      },
    ],
  };
}

function buildRentRoll(d: ReportDataset, ctx: Ctx, f: ReportFilters): ReportModel {
  const tenancies = d.tenancies.filter((t) => {
    if (!f.portfolioId) return true;
    return ctx.propById.get(t.propertyId)?.portfolioId === f.portfolioId;
  });
  const rows: ReportRow[] = tenancies.map((t) => ({
    property: ctx.propById.get(t.propertyId)?.nickname ?? "—",
    tenant: tenantNames(t),
    status: t.status,
    rent: t.rentPence,
    frequency: t.rentFrequency,
    start: t.startDate,
    end: t.endDate ?? "",
    deposit: t.depositPence ?? null,
  }));
  return {
    id: "rent-roll",
    title: "Rent Roll",
    subtitle: "All tenants and tenancy details",
    meta: baseMeta(d, f, false),
    sections: [
      {
        columns: [
          col("property", "Property", "text"), col("tenant", "Tenant(s)", "text"), col("status", "Status", "text"),
          col("rent", "Rent", "money"), col("frequency", "Frequency", "text"), col("start", "Start", "date"),
          col("end", "End", "date"), col("deposit", "Deposit", "money"),
        ],
        rows,
        totals: { property: "Total", rent: rows.reduce((s, r) => s + Number(r.rent), 0) },
        empty: "No tenancies in this portfolio.",
      },
    ],
  };
}

function buildTenantLedger(d: ReportDataset, ctx: Ctx, f: ReportFilters): ReportModel {
  const tenancies = d.tenancies.filter((t) => !f.portfolioId || ctx.propById.get(t.propertyId)?.portfolioId === f.portfolioId);
  const rows: ReportRow[] = [];
  for (const ten of tenancies) {
    const property = ctx.propById.get(ten.propertyId)?.nickname ?? "—";
    const tenant = tenantNames(ten);
    const payments = d.transactions.filter(
      (t) => t.tenancyId === ten.id && t.category === "rent" && t.direction === "income" && !t.deactivated,
    );
    // Expected monthly due dates within the window.
    const expected = expectedDueDates(ten, f, d.today);
    for (const due of expected) {
      const paid = payments.find((p) => (p.rentDueDate ?? p.date).slice(0, 7) === due.slice(0, 7));
      rows.push({
        date: paid?.rentDueDate ?? paid?.date ?? due,
        property,
        tenant,
        type: paid ? "Payment" : "Missed",
        amount: paid ? paid.amountPence : -ten.rentPence,
      });
    }
  }
  rows.sort((a, b) => (String(a.date) < String(b.date) ? -1 : 1));
  return {
    id: "tenant-ledger",
    title: "Tenant Ledger",
    subtitle: "Payments and missed payments per tenant",
    meta: baseMeta(d, f),
    sections: [
      {
        columns: [col("date", "Date", "date"), col("property", "Property", "text"), col("tenant", "Tenant", "text"), col("type", "Type", "text"), col("amount", "Amount", "money")],
        rows,
        totals: { date: "Net received", amount: rows.filter((r) => r.type === "Payment").reduce((s, r) => s + Number(r.amount), 0) },
        empty: "No tenancy activity in this period.",
      },
    ],
  };
}

function buildTrackedTransactions(d: ReportDataset, ctx: Ctx, f: ReportFilters): ReportModel {
  const rows = scope(d, ctx, f)
    .filter((t) => t.category && !t.deactivated)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const data: ReportRow[] = rows.map((t) => ({
    date: t.date,
    property: propName(ctx, t),
    description: t.description,
    category: t.category ? categoryLabel(t.category) : "—",
    treatment: t.category ? CATEGORY_META[t.category].treatment.replace("_", " ") : "—",
    amount: t.direction === "income" ? t.amountPence : -t.amountPence,
  }));
  return {
    id: "tracked-transactions",
    title: "Tracked Transactions",
    subtitle: "All categorised, tracked transactions",
    meta: baseMeta(d, f),
    sections: [
      {
        columns: [
          col("date", "Date", "date"), col("property", "Property", "text"), col("description", "Description", "text"),
          col("category", "Category", "text"), col("treatment", "Tax treatment", "text"), col("amount", "Amount", "money"),
        ],
        rows: data,
        totals: { date: "Net", amount: data.reduce((s, r) => s + Number(r.amount), 0) },
        empty: "No tracked transactions in this period.",
      },
    ],
  };
}

// --- small helpers ----------------------------------------------------------

function col(key: string, label: string, type: ReportColumn["type"]): ReportColumn {
  return { key, label, type };
}
function catCols(): ReportColumn[] {
  return [col("category", "Category", "text"), col("amount", "Amount", "money")];
}
function groupByCategory(rows: Transaction[]): ReportRow[] {
  const m = new Map<string, number>();
  for (const t of rows) {
    const key = t.category ? categoryLabel(t.category) : "Uncategorised";
    m.set(key, (m.get(key) ?? 0) + t.amountPence);
  }
  return [...m.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => Number(b.amount) - Number(a.amount));
}
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1]} ${y}`;
}
function expectedDueDates(ten: Tenancy, f: ReportFilters, today: string): string[] {
  const start = ten.startDate > f.from ? ten.startDate : f.from;
  const endCap = [ten.endDate ?? f.to, f.to, today].sort()[0]; // don't project past today/window/tenancy end
  const day = String(Math.min(28, Math.max(1, ten.rentDueDay))).padStart(2, "0");
  const out: string[] = [];
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7));
  for (let i = 0; i < 36; i++) {
    const due = `${y}-${String(m).padStart(2, "0")}-${day}`;
    if (due > endCap) break;
    if (due >= start) out.push(due);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

const BUILDERS: Record<string, (d: ReportDataset, ctx: Ctx, f: ReportFilters) => ReportModel> = {
  annual: buildAnnual,
  "directors-loans": buildDirectorsLoans,
  "general-ledger": buildGeneralLedger,
  "hammock-tax": buildHammock,
  "income-statement": buildIncomeStatement,
  "monthly-cashflow": buildMonthlyCashflow,
  "net-cashflow": buildNetCashflow,
  "rent-received": buildRentReceived,
  "rent-roll": buildRentRoll,
  "tenant-ledger": buildTenantLedger,
  "tracked-transactions": buildTrackedTransactions,
};

export function buildReport(dataset: ReportDataset, id: string, filters: ReportFilters): ReportModel {
  const builder = BUILDERS[id];
  if (!builder) throw new Error(`Unknown report: ${id}`);
  // Owner apportionment scales every property transaction by the owner's share —
  // identical to the per-owner figures in the Tax module, so they reconcile.
  const ds = filters.ownerId
    ? { ...dataset, transactions: apportionForOwner(dataset.transactions, dataset.properties, filters.ownerId) }
    : dataset;
  const model = builder(ds, buildCtx(ds), filters);
  // Consistent provenance footer in the account's time zone, for every report.
  model.meta.push({ label: "Generated", value: formatDateTimeInTimeZone(dataset.generatedAt, dataset.timeZone) });
  return model;
}
