// MTD orchestration service. Sits between the UI (server actions) and the
// HmrcMtdProvider: manages the OAuth lifecycle, compiles period summaries from
// the user's categorised digital records, submits to HMRC with fraud-prevention
// headers, retrieves calculations, and logs receipts.

import "server-only";
import { randomUUID } from "crypto";
import { providers } from "@/server/providers";
import {
  HmrcApiError,
  type AgentContext,
  type HmrcRequestContext,
  type MtdObligationDTO,
  type TaxCalculationDTO,
} from "@/server/providers/hmrc-mtd";
import { mtdTokenStore, getValidAccessToken } from "./token-store";
import { buildFraudPreventionHeaders, type FraudHeaderClientInfo } from "./fraud-headers";
import { getTransactions, recordMtdSubmission, getSubmissionForObligation } from "@/services/repository";
import { recordAudit } from "@/server/security/audit";
import { CATEGORY_META } from "@/lib/sa105";
import { taxYearBounds } from "@/lib/dates";
import { sumPence } from "@/lib/money";
import type { MtdSubmission, Transaction } from "@/lib/types";

const REDIRECT_URI = (process.env.APP_URL ?? "http://localhost:3000") + "/api/mtd/callback";

export interface MtdConnection {
  connected: boolean;
  scope: string;
  expiresAt: string;
  obtainedAt: string;
}

export interface PeriodSummary {
  totalIncomePence: number;
  totalExpensesPence: number;
}

// --- OAuth lifecycle -------------------------------------------------------

export function beginAuthorization(accountId: string): { authorizationUrl: string; state: string } {
  const state = randomUUID();
  const authorizationUrl = providers.hmrcMtd.getAuthorizationUrl({ accountId, redirectUri: REDIRECT_URI, state });
  return { authorizationUrl, state };
}

export async function completeAuthorization(accountId: string, code: string): Promise<MtdConnection> {
  const tokens = await providers.hmrcMtd.exchangeCodeForTokens(code, REDIRECT_URI);
  await mtdTokenStore.save(accountId, tokens);
  const stored = await mtdTokenStore.get(accountId);
  return toConnection(stored);
}

export async function getConnection(accountId: string): Promise<MtdConnection | null> {
  const tokens = await getValidAccessToken(accountId);
  return tokens ? toConnection(tokens) : null;
}

export async function disconnect(accountId: string): Promise<void> {
  await mtdTokenStore.clear(accountId);
}

function toConnection(t: { scope: string; expiresAt: string; obtainedAt: string } | null): MtdConnection {
  return { connected: Boolean(t), scope: t?.scope ?? "", expiresAt: t?.expiresAt ?? "", obtainedAt: t?.obtainedAt ?? "" };
}

// --- Authorised request context -------------------------------------------

async function requireContext(
  accountId: string,
  opts: { agent?: AgentContext; client?: FraudHeaderClientInfo } = {},
): Promise<HmrcRequestContext> {
  const tokens = await getValidAccessToken(accountId);
  if (!tokens) {
    throw new HmrcApiError("UNAUTHORIZED", "Not connected to HMRC. Authorise the app to continue.", 401);
  }
  return {
    accountId,
    accessToken: tokens.accessToken,
    fraudHeaders: buildFraudPreventionHeaders({ userId: accountId, ...opts.client }),
    agent: opts.agent,
  };
}

// --- Income sources & obligations ------------------------------------------

export async function getIncomeSources(accountId: string) {
  const ctx = await requireContext(accountId);
  return providers.hmrcMtd.getIncomeSources(ctx);
}

export interface ObligationWithStatus extends MtdObligationDTO {
  submission?: MtdSubmission;
}

export async function listObligations(accountId: string, taxYear: string): Promise<ObligationWithStatus[]> {
  const ctx = await requireContext(accountId);
  const obligations = await providers.hmrcMtd.getObligations(ctx, taxYear);
  // Merge HMRC's view with our local submission log to reflect what we've filed.
  return obligations.map((o) => {
    const submission = getSubmissionForObligation(o.obligationId);
    return { ...o, status: submission ? "FULFILLED" : o.status, submission };
  });
}

// --- Period summary compilation (from categorised digital records) ----------

/** Sum a period's categorised, active transactions into income/expense totals. */
export function compilePeriodSummary(fromDate: string, toDate: string): PeriodSummary {
  const rows = getTransactions().filter(
    (t) => !t.deactivated && t.category && t.date >= fromDate && t.date <= toDate,
  );
  const treatment = (t: Transaction) => CATEGORY_META[t.category!].treatment;
  const totalIncomePence = sumPence(rows.filter((t) => treatment(t) === "income").map((t) => t.amountPence));
  const totalExpensesPence = sumPence(
    rows.filter((t) => treatment(t) === "allowable_expense" || treatment(t) === "finance_cost").map((t) => t.amountPence),
  );
  return { totalIncomePence, totalExpensesPence };
}

// --- Submit a quarterly update ---------------------------------------------

export interface SubmitOptions {
  agent?: AgentContext;
  client?: FraudHeaderClientInfo;
  /** User performing the submission (for the audit trail). */
  actorUserId?: string | null;
}

export async function submitQuarterlyUpdate(
  accountId: string,
  obligation: { id: string; taxYear: string; period: string; startDate: string; endDate: string },
  opts: SubmitOptions = {},
): Promise<MtdSubmission> {
  const ctx = await requireContext(accountId, opts);
  const summary = compilePeriodSummary(obligation.startDate, obligation.endDate);
  const receipt = await providers.hmrcMtd.submitPeriodUpdate(ctx, {
    obligationId: obligation.id,
    taxYear: obligation.taxYear,
    period: obligation.period,
    fromDate: obligation.startDate,
    toDate: obligation.endDate,
    totalIncomeMinor: summary.totalIncomePence,
    totalExpensesMinor: summary.totalExpensesPence,
  });
  const submission = recordMtdSubmission({
    id: `sub_${obligation.id}`,
    obligationId: obligation.id,
    submittedAt: receipt.submittedAt,
    totalIncomePence: summary.totalIncomePence,
    totalExpensesPence: summary.totalExpensesPence,
    receiptRef: receipt.receiptRef,
  });

  // External submission to HMRC — always audited.
  await recordAudit({
    accountId,
    actorUserId: opts.actorUserId ?? null,
    action: "SUBMIT",
    entity: "mtd_submission",
    entityId: submission.id,
    summary: `Submitted MTD ${obligation.period} ${obligation.taxYear} update to HMRC (receipt ${receipt.receiptRef})`,
    metadata: {
      totalIncomePence: summary.totalIncomePence,
      totalExpensesPence: summary.totalExpensesPence,
      asAgent: Boolean(opts.agent?.onBehalfOfClient),
    },
  });

  return submission;
}

// --- Tax calculation & Final Declaration -----------------------------------

export async function getTaxCalculation(
  accountId: string,
  taxYear: string,
  opts: SubmitOptions = {},
): Promise<TaxCalculationDTO> {
  const ctx = await requireContext(accountId, opts);
  const { start, end } = taxYearBounds(taxYear);
  const ytd = compilePeriodSummary(start, end);
  return providers.hmrcMtd.getTaxCalculation(ctx, taxYear, {
    totalIncomeMinor: ytd.totalIncomePence,
    totalExpensesMinor: ytd.totalExpensesPence,
  });
}

export async function submitFinalDeclaration(
  accountId: string,
  taxYear: string,
  calculationId: string,
  opts: SubmitOptions = {},
) {
  const ctx = await requireContext(accountId, opts);
  return providers.hmrcMtd.submitFinalDeclaration(ctx, { taxYear, calculationId });
}
