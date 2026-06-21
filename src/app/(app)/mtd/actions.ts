"use server";

import { getSession } from "@/server/auth/session";
import * as mtd from "@/server/mtd/service";
import { HmrcApiError, type AgentContext, type TaxCalculationDTO } from "@/server/providers/hmrc-mtd";
import type { MtdSubmission } from "@/lib/types";
import type { MtdConnection } from "@/server/mtd/service";

// Server actions return a discriminated result so the client can surface HMRC's
// own `{ code, message }` errors clearly rather than a generic failure.
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

function fail(e: unknown): { ok: false; error: { code: string; message: string } } {
  if (e instanceof HmrcApiError) return { ok: false, error: { code: e.code, message: e.message } };
  return { ok: false, error: { code: "UNKNOWN", message: e instanceof Error ? e.message : "Unexpected error" } };
}

async function requireAccount() {
  const session = await getSession();
  if (!session) throw new HmrcApiError("UNAUTHENTICATED", "Your session has expired. Please sign in.", 401);
  return session;
}

/** Agent (accountant) context — when an accountant is delegated, submissions go on behalf of the client. */
function agentFor(session: Awaited<ReturnType<typeof requireAccount>>, asAgent?: boolean): AgentContext | undefined {
  const isAccountant = session.role === "accountant" || session.isDelegated;
  if (asAgent ?? isAccountant) return { onBehalfOfClient: true, agentReferenceNumber: "ARN-LANDLAND-001" };
  return undefined;
}

// --- OAuth -----------------------------------------------------------------

export async function beginAuthorizationAction(): Promise<{ authorizationUrl: string; state: string }> {
  const session = await requireAccount();
  return mtd.beginAuthorization(session.account.id);
}

/** Completes the OAuth handshake. In the sandbox the callback code is simulated. */
export async function completeAuthorizationAction(code: string): Promise<ActionResult<MtdConnection>> {
  try {
    const session = await requireAccount();
    return { ok: true, data: await mtd.completeAuthorization(session.account.id, code) };
  } catch (e) {
    return fail(e);
  }
}

export async function getConnectionAction(): Promise<MtdConnection | null> {
  const session = await requireAccount();
  return mtd.getConnection(session.account.id);
}

export async function disconnectAction(): Promise<{ ok: true }> {
  const session = await requireAccount();
  await mtd.disconnect(session.account.id);
  return { ok: true };
}

// --- Data ------------------------------------------------------------------

export async function submitQuarterlyUpdateAction(input: {
  obligationId: string;
  taxYear: string;
  period: string;
  startDate: string;
  endDate: string;
  asAgent?: boolean;
}): Promise<ActionResult<MtdSubmission>> {
  try {
    const session = await requireAccount();
    const submission = await mtd.submitQuarterlyUpdate(
      session.account.id,
      { id: input.obligationId, taxYear: input.taxYear, period: input.period, startDate: input.startDate, endDate: input.endDate },
      { agent: agentFor(session, input.asAgent), actorUserId: session.user.id },
    );
    return { ok: true, data: submission };
  } catch (e) {
    return fail(e);
  }
}

export async function getTaxCalculationAction(taxYear: string, asAgent?: boolean): Promise<ActionResult<TaxCalculationDTO>> {
  try {
    const session = await requireAccount();
    return { ok: true, data: await mtd.getTaxCalculation(session.account.id, taxYear, { agent: agentFor(session, asAgent) }) };
  } catch (e) {
    return fail(e);
  }
}

export async function submitFinalDeclarationAction(
  taxYear: string,
  calculationId: string,
  asAgent?: boolean,
): Promise<ActionResult<{ receiptRef: string; submittedAt: string }>> {
  try {
    const session = await requireAccount();
    return { ok: true, data: await mtd.submitFinalDeclaration(session.account.id, taxYear, calculationId, { agent: agentFor(session, asAgent) }) };
  } catch (e) {
    return fail(e);
  }
}
