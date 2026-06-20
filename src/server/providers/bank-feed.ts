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
  redirectUrl: string;
  connectionId: string;
}

export interface BankFeedProvider {
  readonly name: string;
  /** Begin an Open Banking consent flow. */
  connect(accountId: string, institutionId: string): Promise<ConnectResult>;
  /** List bank accounts available on a connection. */
  listAccounts(connectionId: string): Promise<ProviderBankAccount[]>;
  /** Pull transactions for a bank account since an optional ISO date. */
  fetchTransactions(externalAccountId: string, since?: string): Promise<NormalizedBankTransaction[]>;
}

export class MockBankFeedProvider implements BankFeedProvider {
  readonly name = "mock";

  async connect(accountId: string, institutionId: string): Promise<ConnectResult> {
    return {
      redirectUrl: `https://mock-openbanking.local/consent?account=${accountId}&institution=${institutionId}`,
      connectionId: `conn_${institutionId}`,
    };
  }

  async listAccounts(connectionId: string): Promise<ProviderBankAccount[]> {
    return [
      {
        externalId: `${connectionId}_current`,
        bankName: "Mock Bank",
        accountName: "Property Current Account",
        maskedNumber: "•••• 4421",
      },
    ];
  }

  async fetchTransactions(externalAccountId: string): Promise<NormalizedBankTransaction[]> {
    // Deterministic sample feed — no network.
    return [
      {
        externalId: `${externalAccountId}-001`,
        date: "2026-06-01",
        amountMinor: 125000,
        currency: "GBP",
        direction: "INCOME",
        description: "Rent — J Fletcher",
      },
      {
        externalId: `${externalAccountId}-002`,
        date: "2026-06-18",
        amountMinor: 4800,
        currency: "GBP",
        direction: "EXPENSE",
        description: "SCREWFIX BRISTOL",
      },
    ];
  }
}
