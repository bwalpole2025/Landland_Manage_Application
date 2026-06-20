import Link from "next/link";
import { PageHeader, Card, Badge, Button, EmptyState } from "@/components/ui";
import { PropertyIcon, ChevronRightIcon } from "@/components/icons";
import {
  getActiveTenancyForProperty,
  getComplianceDocuments,
  getProperties,
  getTransactions,
} from "@/services/repository";
import { computeArrears } from "@/lib/arrears";
import { expiryUrgency } from "@/lib/dates";
import { formatGBP } from "@/lib/money";
import { PROPERTY_TYPE_LABELS, addressOneLine } from "@/lib/labels";

export default function PropertiesPage() {
  const properties = getProperties();
  const transactions = getTransactions();

  return (
    <>
      <PageHeader
        title="My Properties"
        description="Every property, its tenancy, rent status and compliance at a glance."
        actions={<Button>Add property</Button>}
      />

      {properties.length === 0 ? (
        <EmptyState
          title="No properties yet"
          description="Add your first property to start tracking rent, expenses and compliance."
          action={<Button>Add property</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {properties.map((property) => {
            const tenancy = getActiveTenancyForProperty(property.id);
            const arrears = tenancy ? computeArrears(tenancy, transactions) : null;
            const docs = getComplianceDocuments(property.id);
            const docIssues = docs.filter(
              (d) => d.expiryDate && expiryUrgency(d.expiryDate).urgency !== "ok",
            ).length;

            return (
              <Link key={property.id} href={`/properties/${property.id}`}>
                <Card className="h-full p-5 transition hover:border-brand-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <PropertyIcon />
                      </span>
                      <div>
                        <h3 className="font-semibold text-slate-900">{property.nickname}</h3>
                        <p className="text-sm text-slate-500">{addressOneLine(property.address)}</p>
                      </div>
                    </div>
                    <ChevronRightIcon className="text-slate-300" />
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Type</dt>
                      <dd className="font-medium text-slate-800">
                        {PROPERTY_TYPE_LABELS[property.type]} · {property.bedrooms} bed
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Monthly rent</dt>
                      <dd className="font-medium text-slate-800">
                        {tenancy ? formatGBP(tenancy.rentPence, { showPence: false }) : "—"}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {tenancy ? (
                      <Badge tone="brand">Occupied</Badge>
                    ) : (
                      <Badge tone="neutral">Vacant</Badge>
                    )}
                    {arrears?.status === "in_arrears" ? (
                      <Badge tone="danger">{formatGBP(arrears.balancePence, { showPence: false })} arrears</Badge>
                    ) : tenancy ? (
                      <Badge tone="success">Rent up to date</Badge>
                    ) : null}
                    {docIssues > 0 ? (
                      <Badge tone="warning">{docIssues} document{docIssues === 1 ? "" : "s"} due</Badge>
                    ) : (
                      <Badge tone="success">Compliant</Badge>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
