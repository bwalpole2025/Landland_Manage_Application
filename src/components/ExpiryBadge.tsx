import { Badge } from "@/components/ui";
import { expiryUrgency, relativeDays, type ReminderUrgency } from "@/lib/dates";

const tone: Record<ReminderUrgency, "neutral" | "success" | "warning" | "danger"> = {
  expired: "danger",
  critical: "danger",
  soon: "warning",
  upcoming: "warning",
  ok: "success",
};

/** Renders a compliance document's expiry as a coloured badge. */
export function ExpiryBadge({ expiryDate }: { expiryDate?: string }) {
  if (!expiryDate) return <Badge tone="neutral">No expiry</Badge>;
  const { urgency, days } = expiryUrgency(expiryDate);
  const label =
    urgency === "expired"
      ? `Expired ${relativeDays(days!).replace("in ", "")}`
      : urgency === "ok"
        ? "Valid"
        : `Due ${relativeDays(days!)}`;
  return <Badge tone={tone[urgency]}>{label}</Badge>;
}
