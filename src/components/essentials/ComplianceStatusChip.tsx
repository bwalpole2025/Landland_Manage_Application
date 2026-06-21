import { Badge } from "@/components/ds";
import type { ObligationStatus } from "@obligations-engine";

// Red / amber / green are reserved STRICTLY for compliance status. This chip is
// the only component that uses those tones; everything else uses brand/neutral.
const STATUS: Record<ObligationStatus, { tone: "success" | "warning" | "danger" | "neutral"; label: string }> = {
  compliant: { tone: "success", label: "Compliant" }, // green
  due_soon: { tone: "warning", label: "Due soon" }, // amber
  overdue: { tone: "danger", label: "Overdue" }, // red
  not_applicable: { tone: "neutral", label: "Not applicable" }, // grey
};

export function ComplianceStatusChip({ status }: { status: ObligationStatus }) {
  const { tone, label } = STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
