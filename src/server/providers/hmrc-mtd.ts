// HmrcMtdProvider — abstraction over HMRC's Making Tax Digital for Income Tax
// APIs. The real client talks to HMRC over OAuth2 with fraud-prevention headers;
// `MockHmrcMtdProvider` is a local SANDBOX that mirrors the same contract with no
// network and — critically — NO Government Gateway passwords (OAuth tokens only).
//
// Swap the implementation in providers/index.ts (HMRC_MTD_PROVIDER=hmrc) once a
// live client exists; no application code changes.

// --- OAuth -----------------------------------------------------------------

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  /** ISO datetime the access token expires. */
  expiresAt: string;
  scope: string;
  tokenType: "bearer";
}

export interface AuthorizationUrlInput {
  accountId: string;
  redirectUri: string;
  /** Opaque CSRF state echoed back on the callback. */
  state: string;
  scope?: string;
}

// --- Request context (every data call carries auth + fraud headers) ---------

export interface AgentContext {
  /** True when an agent (accountant) is acting for the client. */
  onBehalfOfClient: boolean;
  agentReferenceNumber?: string;
}

export interface HmrcRequestContext {
  accountId: string;
  /** Bearer access token from the OAuth flow. */
  accessToken: string;
  /** HMRC fraud-prevention (`Gov-Client-*` / `Gov-Vendor-*`) headers. */
  fraudHeaders: Record<string, string>;
  agent?: AgentContext;
}

// --- DTOs ------------------------------------------------------------------

export interface IncomeSourceDTO {
  incomeSourceId: string;
  type: "uk-property";
  tradingName: string;
  accountingType: "CASH" | "ACCRUALS";
  commencementDate: string;
}

export interface MtdObligationDTO {
  obligationId: string;
  taxYear: string;
  period: string; // "Q1".."Q4"
  startDate: string;
  endDate: string;
  dueDate: string;
  status: "OPEN" | "FULFILLED" | "OVERDUE";
}

export interface PeriodSummaryInput {
  obligationId: string;
  taxYear: string;
  period: string;
  fromDate: string;
  toDate: string;
  totalIncomeMinor: number;
  totalExpensesMinor: number;
}

export interface SubmissionReceipt {
  receiptRef: string;
  submittedAt: string; // ISO datetime
}

export interface TaxCalculationMessage {
  type: "info" | "warning";
  text: string;
}

export interface TaxCalculationDTO {
  calculationId: string;
  taxYear: string;
  totalIncomeMinor: number;
  totalExpensesMinor: number;
  taxableProfitMinor: number;
  incomeTaxMinor: number;
  class4NicMinor: number;
  totalDueMinor: number;
  calculatedAt: string;
  messages: TaxCalculationMessage[];
}

export interface FinalDeclarationInput {
  taxYear: string;
  calculationId: string;
}

export interface HmrcMtdProvider {
  readonly name: string;
  // OAuth
  getAuthorizationUrl(input: AuthorizationUrlInput): string;
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens>;
  refreshTokens(refreshToken: string): Promise<OAuthTokens>;
  // Data (all require a valid token + fraud headers)
  getIncomeSources(ctx: HmrcRequestContext): Promise<IncomeSourceDTO[]>;
  getObligations(ctx: HmrcRequestContext, taxYear: string): Promise<MtdObligationDTO[]>;
  submitPeriodUpdate(ctx: HmrcRequestContext, input: PeriodSummaryInput): Promise<SubmissionReceipt>;
  getTaxCalculation(
    ctx: HmrcRequestContext,
    taxYear: string,
    summary: { totalIncomeMinor: number; totalExpensesMinor: number },
  ): Promise<TaxCalculationDTO>;
  submitFinalDeclaration(ctx: HmrcRequestContext, input: FinalDeclarationInput): Promise<SubmissionReceipt>;
}

/** Structured error mirroring HMRC's `{ code, message }` body, surfaced to the UI. */
export class HmrcApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus = 400,
  ) {
    super(message);
    this.name = "HmrcApiError";
  }
}

// Minimal fraud-prevention headers HMRC will not accept a submission without.
export const REQUIRED_FRAUD_HEADERS = [
  "Gov-Client-Connection-Method",
  "Gov-Client-Device-ID",
  "Gov-Client-Timezone",
  "Gov-Vendor-Product-Name",
  "Gov-Vendor-Version",
];

const OAUTH_SCOPE = "read:self-assessment write:self-assessment";
const ACCESS_TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // HMRC access tokens last 4 hours.
const FIXED_NOW = "2026-06-20T12:00:00.000Z"; // deterministic clock for the sandbox

function quartersFor(taxYear: string): MtdObligationDTO[] {
  const y = Number(taxYear.slice(0, 4));
  const yy = `${String(y % 100).padStart(2, "0")}${String((y + 1) % 100).padStart(2, "0")}`;
  const mk = (n: number, start: string, end: string, due: string): MtdObligationDTO => ({
    obligationId: `ob_${yy}_q${n}`,
    taxYear,
    period: `Q${n}`,
    startDate: start,
    endDate: end,
    dueDate: due,
    status: "OPEN",
  });
  return [
    mk(1, `${y}-04-06`, `${y}-07-05`, `${y}-08-07`),
    mk(2, `${y}-07-06`, `${y}-10-05`, `${y}-11-07`),
    mk(3, `${y}-10-06`, `${y + 1}-01-05`, `${y + 1}-02-07`),
    mk(4, `${y + 1}-01-06`, `${y + 1}-04-05`, `${y + 1}-05-07`),
  ];
}

/**
 * Local HMRC sandbox. Validates the same preconditions as the live API — a
 * non-empty bearer token and the required fraud-prevention headers — then
 * returns deterministic data. No credentials, no network.
 */
export class MockHmrcMtdProvider implements HmrcMtdProvider {
  readonly name = "sandbox";

  getAuthorizationUrl(input: AuthorizationUrlInput): string {
    const scope = encodeURIComponent(input.scope ?? OAUTH_SCOPE);
    const redirect = encodeURIComponent(input.redirectUri);
    // Mirrors HMRC's authorize endpoint shape.
    return `https://test-api.service.hmrc.gov.uk/oauth/authorize?response_type=code&client_id=landland-sandbox&scope=${scope}&state=${encodeURIComponent(input.state)}&redirect_uri=${redirect}`;
  }

  async exchangeCodeForTokens(code: string, _redirectUri: string): Promise<OAuthTokens> {
    if (!code) throw new HmrcApiError("invalid_grant", "Missing authorization code", 400);
    return this.mintTokens();
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    if (!refreshToken || !refreshToken.startsWith("rt_")) {
      throw new HmrcApiError("invalid_grant", "Invalid or expired refresh token", 400);
    }
    return this.mintTokens();
  }

  private mintTokens(): OAuthTokens {
    const rnd = Math.abs(hash(FIXED_NOW)).toString(36);
    return {
      accessToken: `at_${rnd}`,
      refreshToken: `rt_${rnd}`,
      expiresAt: new Date(Date.parse(FIXED_NOW) + ACCESS_TOKEN_TTL_MS).toISOString(),
      scope: OAUTH_SCOPE,
      tokenType: "bearer",
    };
  }

  private assertAuthorised(ctx: HmrcRequestContext): void {
    if (!ctx.accessToken || !ctx.accessToken.startsWith("at_")) {
      throw new HmrcApiError("UNAUTHORIZED", "Bearer access token is missing or invalid — re-authorise with HMRC.", 401);
    }
    const missing = REQUIRED_FRAUD_HEADERS.filter((h) => !ctx.fraudHeaders?.[h]);
    if (missing.length > 0) {
      throw new HmrcApiError(
        "PRECONDITION_FAILED",
        `Missing required fraud-prevention headers: ${missing.join(", ")}`,
        422,
      );
    }
  }

  async getIncomeSources(ctx: HmrcRequestContext): Promise<IncomeSourceDTO[]> {
    this.assertAuthorised(ctx);
    return [
      {
        incomeSourceId: "X0IS00000000001",
        type: "uk-property",
        tradingName: "UK Property Business",
        accountingType: "CASH",
        commencementDate: "2019-04-06",
      },
    ];
  }

  async getObligations(ctx: HmrcRequestContext, taxYear: string): Promise<MtdObligationDTO[]> {
    this.assertAuthorised(ctx);
    return quartersFor(taxYear);
  }

  async submitPeriodUpdate(ctx: HmrcRequestContext, input: PeriodSummaryInput): Promise<SubmissionReceipt> {
    this.assertAuthorised(ctx);
    if (input.totalIncomeMinor < 0 || input.totalExpensesMinor < 0) {
      throw new HmrcApiError("FORMAT_VALUE", "Period totals must not be negative.", 400);
    }
    const slug = `${input.taxYear}${input.period}`.replace(/[^a-z0-9]/gi, "").toUpperCase();
    const agentTag = ctx.agent?.onBehalfOfClient ? "AG" : "SE";
    return {
      receiptRef: `HMRC-MTD-${slug}-${agentTag}-${shortHash(input.obligationId)}`,
      submittedAt: FIXED_NOW,
    };
  }

  async getTaxCalculation(
    ctx: HmrcRequestContext,
    taxYear: string,
    summary: { totalIncomeMinor: number; totalExpensesMinor: number },
  ): Promise<TaxCalculationDTO> {
    this.assertAuthorised(ctx);
    // HMRC computes its own figures from submitted data; the sandbox derives a
    // representative calculation from the period totals it has been given.
    const personalAllowance = 1_257_000;
    const taxableProfit = Math.max(0, summary.totalIncomeMinor - summary.totalExpensesMinor);
    const incomeTax = Math.round(0.2 * Math.max(0, taxableProfit - personalAllowance));
    const class4Lower = 1_257_000;
    const class4Nic = Math.round(0.06 * Math.max(0, taxableProfit - class4Lower));
    const totalDue = incomeTax + class4Nic;
    return {
      calculationId: `calc_${taxYear.replace("/", "")}_${shortHash(String(taxableProfit))}`,
      taxYear,
      totalIncomeMinor: summary.totalIncomeMinor,
      totalExpensesMinor: summary.totalExpensesMinor,
      taxableProfitMinor: taxableProfit,
      incomeTaxMinor: incomeTax,
      class4NicMinor: class4Nic,
      totalDueMinor: totalDue,
      calculatedAt: FIXED_NOW,
      messages:
        taxableProfit <= personalAllowance
          ? [{ type: "info", text: "Estimated taxable profit is within your personal allowance." }]
          : [],
    };
  }

  async submitFinalDeclaration(ctx: HmrcRequestContext, input: FinalDeclarationInput): Promise<SubmissionReceipt> {
    this.assertAuthorised(ctx);
    if (!input.calculationId) {
      throw new HmrcApiError("MATCHING_RESOURCE_NOT_FOUND", "A tax calculation must be retrieved before the Final Declaration.", 400);
    }
    const agentTag = ctx.agent?.onBehalfOfClient ? "AG" : "SE";
    return {
      receiptRef: `HMRC-MTD-FINAL-${input.taxYear.replace("/", "")}-${agentTag}-${shortHash(input.calculationId)}`,
      submittedAt: FIXED_NOW,
    };
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
function shortHash(s: string): string {
  return Math.abs(hash(s)).toString(36).slice(0, 6).toUpperCase().padStart(6, "0");
}
