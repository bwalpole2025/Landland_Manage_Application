import type { Meta, StoryObj } from "@storybook/react";
import { DataTable, type Column } from "./DataTable";
import { Badge } from "./Badge";
import { Select } from "./Select";

interface Txn {
  date: string;
  description: string;
  property: string;
  amount: string;
  status: "Reconciled" | "Needs review";
}

const rows: Txn[] = [
  { date: "01 Jun 2026", description: "Rent — J Fletcher", property: "Oakfield Road", amount: "+£1,250.00", status: "Reconciled" },
  { date: "15 Jun 2026", description: "Rent — M Costa", property: "Harbourside", amount: "+£500.00", status: "Needs review" },
  { date: "18 Jun 2026", description: "SCREWFIX BRISTOL", property: "Unassigned", amount: "−£48.00", status: "Needs review" },
  { date: "20 May 2026", description: "Boiler service & repair", property: "Oakfield Road", amount: "−£186.00", status: "Reconciled" },
];

const columns: Column<Txn>[] = [
  { key: "date", header: "Date" },
  { key: "description", header: "Description", render: (r) => <span className="font-medium text-slate-900">{r.description}</span> },
  { key: "property", header: "Property" },
  { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "Reconciled" ? "success" : "warning"}>{r.status}</Badge> },
  { key: "amount", header: "Amount", align: "right", render: (r) => <span className="font-semibold">{r.amount}</span> },
];

const meta: Meta<typeof DataTable<Txn>> = {
  title: "Components/DataTable",
  component: DataTable,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof DataTable<Txn>>;

export const WithFilters: Story = {
  render: () => (
    <div className="w-[820px] max-w-full">
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.description + r.date}
        searchAccessor={(r) => `${r.description} ${r.property}`}
        searchPlaceholder="Search transactions…"
        filters={<Select options={[{ value: "all", label: "All properties" }, { value: "oak", label: "Oakfield Road" }, { value: "harbour", label: "Harbourside" }]} defaultValue="all" />}
      />
    </div>
  ),
};
