"use server";

import { providers } from "@/server/providers";
import type { MtdSubmission } from "@/lib/types";

// Server action that routes through the deferred HMRC integration (providers.hmrcMtd).
// Today it hits the mock; swapping in the real HMRC MTD client requires no UI changes.
export async function submitQuarterlyUpdateAction(input: {
  obligationId: string;
  taxYear: string;
  period: string;
  totalIncomePence: number;
  totalExpensesPence: number;
}): Promise<MtdSubmission> {
  const receipt = await providers.hmrcMtd.submitQuarterlyUpdate("acc_demo", {
    obligationId: input.obligationId,
    taxYear: input.taxYear,
    period: input.period,
    totalIncomeMinor: input.totalIncomePence,
    totalExpensesMinor: input.totalExpensesPence,
  });
  return {
    id: `sub_${input.obligationId}`,
    obligationId: input.obligationId,
    submittedAt: receipt.submittedAt,
    totalIncomePence: input.totalIncomePence,
    totalExpensesPence: input.totalExpensesPence,
    receiptRef: receipt.receiptRef,
  };
}
