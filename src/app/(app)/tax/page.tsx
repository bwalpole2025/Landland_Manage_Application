import { PageHeader, Card, CardHeader, StatTile, Disclaimer, Badge, Button } from "@/components/ui";
import { getTransactions } from "@/services/repository";
import { estimateTax } from "@/lib/tax";
import { taxYearFor } from "@/lib/dates";
import { now } from "@/lib/clock";
import { formatGBP } from "@/lib/money";
import { TAX_DISCLAIMER } from "@/lib/sa105";

export default function TaxPage() {
  const taxYear = taxYearFor(now());
  const tax = estimateTax(getTransactions(), taxYear);

  return (
    <>
      <PageHeader
        title="Tax estimate"
        description={`A year-to-date estimate for ${taxYear}, mapped to HMRC's SA105 UK property pages.`}
        actions={
          <>
            <Badge tone="neutral">Tax year {taxYear}</Badge>
            <Button variant="secondary">Export SA105 summary</Button>
          </>
        }
      />

      <Disclaimer>{TAX_DISCLAIMER}</Disclaimer>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total income" value={formatGBP(tax.totalIncomePence, { showPence: false })} tone="success" />
        <StatTile label="Total expenses" value={formatGBP(tax.totalExpensesPence, { showPence: false })} />
        <StatTile label="Taxable profit" value={formatGBP(tax.taxableProfitPence, { showPence: false })} tone="brand" />
        <StatTile
          label="Estimated tax"
          value={formatGBP(tax.estimatedTaxPence, { showPence: false })}
          sub="estimate · not advice"
          tone="warning"
        />
      </div>

      <Card>
        <CardHeader
          title="SA105 breakdown"
          subtitle="Your categorised transactions aggregated into the SA105 box numbers"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Box</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tax.boxes.map((box) => (
                <tr key={box.box} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-slate-500">{box.box}</td>
                  <td className="px-5 py-3 text-slate-800">{box.label}</td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-900">
                    {formatGBP(box.amountPence)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="How this estimate works" />
        <div className="space-y-2 p-5 text-sm text-slate-600">
          <p>
            Profit is income (box 20) less allowable expenses (boxes 24–29). Residential{" "}
            <strong>finance costs</strong> such as mortgage interest (box 44,{" "}
            {formatGBP(tax.financeCostsPence, { showPence: false })}) are not deducted from profit —
            instead they attract a <strong>basic-rate (20%) tax reduction</strong>.
          </p>
          <p>
            We apply the personal allowance and basic rate to give an indicative figure. This is a
            simplified, single-source estimate and does not account for your other income, allowances
            or reliefs.
          </p>
        </div>
      </Card>
    </>
  );
}
