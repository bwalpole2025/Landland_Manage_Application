// BankFeedProvider — abstraction over Open Banking aggregators (TrueLayer,
// Plaid, Yapily, …). The app depends only on this interface; swap the concrete
// implementation in providers/index.ts. A mock is provided for local dev.

export interface NormalizedBankTransaction {
  /** Stable id from the provider — used as an idempotency key on import. */
  externalId: string;
  date: string; // ISO date
  amountMinor: number; // positive integer minor units
  currency: string; // ISO-4217
  direction: "INCOME" | "EXPENSE";
  description: string;
}

export interface ProviderBankAccount {
  externalId: string;
  bankName: string;
  accountName: string;
  maskedNumber: string;
}

export interface ConnectResult {
  /** Open Banking consent screen the user is redirected to. */
  redirectUrl: string;
  /** Opaque connection handle. We persist only this token, never credentials. */
  connectionId: string;
  /** When the consent expires and must be renewed (ISO datetime). */
  consentExpiresAt: string;
}

export interface BankFeedProvider {
  readonly name: string;
  /** Begin an Open Banking consent flow. Returns a consent redirect + token. */
  connect(accountId: string, institutionId: string): Promise<ConnectResult>;
  /** List bank accounts available on a connection. */
  listAccounts(connectionId: string): Promise<ProviderBankAccount[]>;
  /** Pull transactions for a bank account since an optional ISO date. */
  fetchTransactions(externalAccountId: string, since?: string): Promise<NormalizedBankTransaction[]>;
  /**
   * Dev-only: synthesise a single inbound webhook event (a new transaction),
   * letting the UI demonstrate real-time notifications without a live provider.
   */
  simulateWebhookEvent?(externalAccountId: string): Promise<NormalizedBankTransaction>;
}

/** A consent is good for 90 days under Open Banking before re-authorisation. */
const CONSENT_DAYS = 90;

// Friendly bank names for the sandbox consent flow, keyed by institution id.
const MOCK_BANKS: Record<string, string> = {
  barclays: "Barclays",
  starling: "Starling",
  monzo: "Monzo",
  natwest: "NatWest",
  hsbc: "HSBC",
  lloyds: "Lloyds",
  revolut: "Revolut",
};

/**
 * Local Open-Banking sandbox. No network and no credentials — `connect()`
 * returns a (fake) consent URL and an opaque connection token; transactions are
 * deterministic samples. Mirrors the shape of TrueLayer/Plaid/Yapily.
 */
export class MockBankFeedProvider implements BankFeedProvider {
  readonly name = "mock";

  async connect(accountId: string, institutionId: string): Promise<ConnectResult> {
    const expires = new Date("2026-06-20T12:00:00.000Z");
    expires.setUTCDate(expires.getUTCDate() + CONSENT_DAYS);
    return {
      redirectUrl: `https://sandbox.openbanking.local/consent?account=${accountId}&institution=${institutionId}&scope=accounts.read+transactions.read`,
      connectionId: `conn_${institutionId}_${accountId}`,
      consentExpiresAt: expires.toISOString(),
    };
  }

  async listAccounts(connectionId: string): Promise<ProviderBankAccount[]> {
    const institutionId = connectionId.split("_")[1] ?? "mock";
    const bankName = MOCK_BANKS[institutionId] ?? "Mock Bank";
    return [
      {
        externalId: `${connectionId}_current`,
        bankName,
        accountName: "Property Current Account",
        maskedNumber: "•••• 7788",
      },
    ];
  }

  async fetchTransactions(externalAccountId: string): Promise<NormalizedBankTransaction[]> {
    // Deterministic, NEW sample feed (distinct from the seeded ledger) so the
    // imported items are visibly added rather than deduplicated away.
    return [
      { externalId: `${externalAccountId}-1001`, date: "2026-06-20", amountMinor: 92500, currency: "GBP", direction: "INCOME", description: "FASTER PAYMENT REF 8841" },
      { externalId: `${externalAccountId}-1002`, date: "2026-06-21", amountMinor: 7240, currency: "GBP", direction: "EXPENSE", description: "TOOLSTATION LTD" },
      { externalId: `${externalAccountId}-1003`, date: "2026-06-22", amountMinor: 1800, currency: "GBP", direction: "EXPENSE", description: "HM LAND REGISTRY FEE" },
    ];
  }

  async simulateWebhookEvent(externalAccountId: string): Promise<NormalizedBankTransaction> {
    // A fresh inbound payment, as a provider would push over a webhook.
    return {
      externalId: `${externalAccountId}-wh-${Math.round((Date.UTC(2026, 5, 23) % 100000))}`,
      date: "2026-06-23",
      amountMinor: 110000,
      currency: "GBP",
      direction: "INCOME",
      description: "FASTER PAYMENT — M COSTA",
    };
  }
}
