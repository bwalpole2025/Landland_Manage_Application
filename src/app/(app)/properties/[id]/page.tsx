import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Card, CardHeader, Badge, Button, StatTile, EmptyState } from "@/components/ui";
import { ExpiryBadge } from "@/components/ExpiryBadge";
import {
  getComplianceDocuments,
  getProperty,
  getTenanciesForProperty,
  getTransactions,
  getUser,
} from "@/services/repository";
import { computeArrears } from "@/lib/arrears";
import { getYtdTotals } from "@/lib/portfolio";
import { taxYearBounds, taxYearFor, formatDate } from "@/lib/dates";
import { now } from "@/lib/clock";
import { formatGBP } from "@/lib/money";
import { categoryLabel } from "@/lib/sa105";
import { PROPERTY_TYPE_LABELS, DOC_TYPE_LABELS, addressOneLine } from "@/lib/labels";
import { sumPence } from "@/lib/money";

export default function PropertyDetailPage({ params }: { params: { id: string } }) {
  const property = getProperty(params.id);
  if (!property) notFound();

  const taxYear = taxYearFor(now());
  const { start, end } = taxYearBounds(taxYear);
  const tenancies = getTenanciesForProperty(property.id);
  const activeTenancy = tenancies.find((t) => t.status === "active");
  const allTx = getTransactions({ propertyId: property.id });
  const ytdTx = allTx.filter((t) => t.date >= start && t.date <= end);
  const income = sumPence(ytdTx.filter((t) => t.direction === "income").map((t) => t.amountPence));
  const expenses = sumPence(ytdTx.filter((t) => t.direction === "expense").map((t) => t.amountPence));
  const arrears = activeTenancy ? computeArrears(activeTenancy, getTransactions()) : null;
  const docs = getComplianceDocuments(property.id);

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/properties" className="hover:text-slate-700">My Properties</Link>
        <span>/</span>
        <span className="text-slate-700">{property.nickname}</span>
      </div>

      <PageHeader
        title={property.nickname}
        description={addressOneLine(property.address)}
        actions={
          <>
            <Button variant="secondary" href={`/transactions`}>View transactions</Button>
            <Button variant="secondary">Edit</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{PROPERTY_TYPE_LABELS[property.type]}</Badge>
        <Badge tone="neutral">{property.bedrooms} bedrooms</Badge>
        {activeTenancy ? <Badge tone="brand">Occupied</Badge> : <Badge tone="neutral">Vacant</Badge>}
        {property.purchasePricePence ? (
          <Badge tone="neutral">
            Bought {property.purchaseDate ? formatDate(property.purchaseDate) : ""} ·{" "}
            {formatGBP(property.purchasePricePence, { showPence: false })}
          </Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Monthly rent"
          value={activeTenancy ? formatGBP(activeTenancy.rentPence, { showPence: false }) : "—"}
          tone="brand"
        />
        <StatTile label={`Income (${taxYear})`} value={formatGBP(income, { showPence: false })} tone="success" />
        <StatTile label={`Expenses (${taxYear})`} value={formatGBP(expenses, { showPence: false })} />
        <StatTile
          label="Rent status"
          value={arrears?.status === "in_arrears" ? formatGBP(arrears.balancePence, { showPence: false }) : "Up to date"}
          tone={arrears?.status === "in_arrears" ? "danger" : "success"}
          sub={arrears?.status === "in_arrears" ? "in arrears" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Tenancy */}
          <Card>
            <CardHeader title="Current tenancy" action={<Button variant="secondary">Add tenancy</Button>} />
            {activeTenancy ? (
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {activeTenancy.tenants.map((tn) => (
                    <Badge key={tn.id} tone="brand">{tn.name}</Badge>
                  ))}
                </div>
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-slate-500">Rent</dt>
                    <dd className="font-medium text-slate-800">
                      {formatGBP(activeTenancy.rentPence)} / {activeTenancy.rentFrequency === "monthly" ? "mo" : "wk"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Due day</dt>
                    <dd className="font-medium text-slate-800">{activeTenancy.rentDueDay}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Started</dt>
                    <dd className="font-medium text-slate-800">{formatDate(activeTenancy.startDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Deposit</dt>
                    <dd className="font-medium text-slate-800">
                      {activeTenancy.depositPence ? formatGBP(activeTenancy.depositPence, { showPence: false }) : "—"}
                      {activeTenancy.depositScheme ? (
                        <span className="ml-1 uppercase text-slate-400">({activeTenancy.depositScheme})</span>
                      ) : null}
                    </dd>
                  </div>
                </dl>
                {arrears?.status === "in_arrears" ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <strong>Missing rent:</strong> {formatGBP(arrears.balancePence)} outstanding.
                    {arrears.lastPaymentDate ? ` Last payment ${formatDate(arrears.lastPaymentDate)}.` : ""}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="p-5">
                <EmptyState
                  title="No active tenancy"
                  description="Add a tenancy to start tracking rent due and arrears for this property."
                  action={<Button>Add tenancy</Button>}
                />
              </div>
            )}
          </Card>

          {/* Recent transactions */}
          <Card>
            <CardHeader
              title="Recent transactions"
              action={<Button variant="secondary" href="/transactions">View all</Button>}
            />
            {ytdTx.length === 0 ? (
              <div className="p-5 text-sm text-slate-500">No transactions yet this tax year.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {allTx.slice(0, 6).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{t.description}</p>
                      <p className="text-xs text-slate-500">{formatDate(t.date)} · {categoryLabel(t.category)}</p>
                    </div>
                    <span className={`text-sm font-semibold ${t.direction === "income" ? "text-emerald-600" : "text-slate-700"}`}>
                      {t.direction === "income" ? "+" : "−"}{formatGBP(t.amountPence)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* Compliance documents */}
          <Card>
            <CardHeader title="Compliance documents" action={<Button variant="secondary" href="/files">Manage</Button>} />
            {docs.length === 0 ? (
              <div className="p-5 text-sm text-slate-500">No documents stored.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{DOC_TYPE_LABELS[doc.type]}</p>
                      <p className="truncate text-xs text-slate-500">{doc.title}</p>
                    </div>
                    <ExpiryBadge expiryDate={doc.expiryDate} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Ownership */}
          <Card>
            <CardHeader title="Ownership" subtitle="Drives P&L apportionment" />
            <ul className="divide-y divide-slate-100">
              {property.ownership.map((o) => {
                const user = getUser(o.userId);
                return (
                  <li key={o.userId} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="font-medium text-slate-800">{user?.name ?? o.userId}</span>
                    <span className="text-slate-600">{o.share}%</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
