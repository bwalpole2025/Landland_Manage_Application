// HmrcMtdProvider — abstraction over HMRC's Making Tax Digital for Income Tax
// APIs (obligations, quarterly updates, final declaration). The real client adds
// OAuth2 + fraud-prevention headers; the mock keeps everything local.

export interface MtdObligationDTO {
  taxYear: string;
  period: string; // e.g. "Q1"
  startDate: string;
  endDate: string;
  dueDate: string;
  status: "OPEN" | "FULFILLED" | "OVERDUE";
}

export interface QuarterlyUpdateInput {
  obligationId: string;
  taxYear: string;
  period: string;
  totalIncomeMinor: number;
  totalExpensesMinor: number;
}

export interface SubmissionReceipt {
  receiptRef: string;
  submittedAt: string; // ISO datetime
}

export interface HmrcMtdProvider {
  readonly name: string;
  isEnrolled(accountId: string): Promise<boolean>;
  getObligations(accountId: string, taxYear: string): Promise<MtdObligationDTO[]>;
  submitQuarterlyUpdate(accountId: string, input: QuarterlyUpdateInput): Promise<SubmissionReceipt>;
}

export class MockHmrcMtdProvider implements HmrcMtdProvider {
  readonly name = "mock";

  async isEnrolled(): Promise<boolean> {
    return true;
  }

  async getObligations(): Promise<MtdObligationDTO[]> {
    return [];
  }

  async submitQuarterlyUpdate(
    _accountId: string,
    input: QuarterlyUpdateInput,
  ): Promise<SubmissionReceipt> {
    const slug = `${input.taxYear}${input.period}`.replace(/[^a-z0-9]/gi, "").toUpperCase();
    return {
      receiptRef: `HMRC-MTD-${slug}-${input.obligationId.slice(-6).toUpperCase()}`,
      // Fixed timestamp keeps tests deterministic; real client uses server time.
      submittedAt: "2026-06-20T09:00:00.000Z",
    };
  }
}
