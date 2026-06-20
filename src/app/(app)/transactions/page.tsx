import { PageHeader, Card, CardHeader, StatTile, Button, Badge } from "@/components/ui";
import { BankFeedStatus } from "@/components/transactions/BankFeedStatus";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { getBankAccounts, getProperties, getTransactions } from "@/services/repository";
import { taxYearBounds, taxYearFor } from "@/lib/dates";
import { now } from "@/lib/clock";
import { formatGBP, sumPence } from "@/lib/money";

export default function TransactionsPage() {
  const taxYear = taxYearFor(now());
  const { start, end } = taxYearBounds(taxYear);

  const properties = getProperties();
  const propertyNames = Object.fromEntries(properties.map((p) => [p.id, p.nickname]));

  const all = getTransactions();
  const ytd = all.filter((t) => t.date >= start && t.date <= end);
  const needsReview = all.filter((t) => t.reconcile === "unreconciled");

  const income = sumPence(ytd.filter((t) => t.direction === "income").map((t) => t.amountPence));
  const expenses = sumPence(ytd.filter((t) => t.direction === "expense").map((t) => t.amountPence));

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every penny in and out — imported from your bank feed and categorised against the SA105 tax boxes."
        actions={<Button>Add transaction</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label={`Income (${taxYear})`} value={formatGBP(income, { showPence: false })} tone="success" />
        <StatTile label={`Expenses (${taxYear})`} value={formatGBP(expenses, { showPence: false })} />
        <StatTile
          label="Needs review"
          value={String(needsReview.length)}
          sub="unreconciled items"
          tone={needsReview.length > 0 ? "warning" : "success"}
        />
      </div>

      <BankFeedStatus accounts={getBankAccounts()} />

      {needsReview.length > 0 ? (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                Needs review <Badge tone="warning">{needsReview.length}</Badge>
              </span>
            }
            subtitle="Newly imported items to assign to a property and categorise"
            action={<Button variant="secondary">Auto-categorise</Button>}
          />
          <TransactionsTable rows={needsReview} propertyNames={propertyNames} />
        </Card>
      ) : null}

      <Card>
        <CardHeader title="All transactions" subtitle={`${all.length} items`} />
        <TransactionsTable rows={all} propertyNames={propertyNames} />
      </Card>
    </>
  );
}
