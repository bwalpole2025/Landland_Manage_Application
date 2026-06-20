"use client";

import { Card, Button } from "@/components/ui";
import { CheckIcon, TransactionsIcon, FilesIcon } from "@/components/icons";

/** Empty-state: the two ways to get transaction data in. */
export function InputChoiceCards({ onConnect, onImport }: { onConnect: () => void; onImport: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Choice
        icon={<TransactionsIcon className="h-7 w-7" />}
        title="Bank feeds"
        features={["Real-time payment notifications", "Missing rental payment alerts", "Automatic arrears management"]}
        cta="Connect a bank feed"
        onClick={onConnect}
        primary
      />
      <Choice
        icon={<FilesIcon className="h-7 w-7" />}
        title="Spreadsheet uploads"
        features={["Rental income & expenses history", "Attach receipts and invoices", "Bulk-import from CSV or Excel"]}
        cta="Upload spreadsheets"
        onClick={onImport}
      />
    </div>
  );
}

function Choice({
  icon,
  title,
  features,
  cta,
  onClick,
  primary = false,
}: {
  icon: React.ReactNode;
  title: string;
  features: string[];
  cta: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <Card className="flex flex-col p-6">
      <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${primary ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"}`}>
        {icon}
      </span>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 flex-1 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5 text-sm text-slate-600">
            <CheckIcon width={16} height={16} className="mt-0.5 shrink-0 text-brand-500" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <Button variant={primary ? "primary" : "secondary"} onClick={onClick}>{cta}</Button>
      </div>
    </Card>
  );
}
