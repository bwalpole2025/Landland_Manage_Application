// Provider registry — the single place that selects each integration's concrete
// implementation (by env). No application code imports a concrete provider; it
// imports from here. Swapping a mock for a real adapter is a one-line change.

import { env } from "@/server/env";
import { MockBankFeedProvider, type BankFeedProvider } from "./bank-feed";
import { MockHmrcMtdProvider, type HmrcMtdProvider } from "./hmrc-mtd";
import {
  MockDocumentStorage,
  S3DocumentStorage,
  type DocumentStorage,
} from "./document-storage";
import { ConsoleMailer, type Mailer } from "./mailer";

function makeBankFeed(): BankFeedProvider {
  switch (env.providers.bankFeed) {
    // case "truelayer": return new TrueLayerBankFeedProvider();
    default:
      return new MockBankFeedProvider();
  }
}

function makeHmrcMtd(): HmrcMtdProvider {
  switch (env.providers.hmrcMtd) {
    // case "hmrc": return new HmrcMtdLiveProvider();
    default:
      return new MockHmrcMtdProvider();
  }
}

function makeDocumentStorage(): DocumentStorage {
  switch (env.providers.documentStorage) {
    case "s3":
      return new S3DocumentStorage();
    default:
      return new MockDocumentStorage();
  }
}

function makeMailer(): Mailer {
  switch (env.providers.mailer) {
    // case "ses": return new SesMailer();
    default:
      return new ConsoleMailer();
  }
}

export const providers = {
  bankFeed: makeBankFeed(),
  hmrcMtd: makeHmrcMtd(),
  documentStorage: makeDocumentStorage(),
  mailer: makeMailer(),
};

export type { BankFeedProvider } from "./bank-feed";
export type { HmrcMtdProvider } from "./hmrc-mtd";
export type { DocumentStorage } from "./document-storage";
export type { Mailer } from "./mailer";
