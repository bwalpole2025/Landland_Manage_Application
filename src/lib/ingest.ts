// Shared ingestion helpers used by both data-in paths (bank feed + CSV import):
// normalising a provider transaction into the app's Transaction shape, and a
// dedupe key so re-imports / overlapping feeds don't create duplicates.

import type { NormalizedBankTransaction } from "@/server/providers/bank-feed";
import type { Transaction } from "./types";

/** Map a provider's normalised transaction onto the app Transaction shape. */
export function normalizeBankTransaction(n: NormalizedBankTransaction, bankAccountId: string): Transaction {
  return {
    id: `txn_feed_${n.externalId}`,
    accountId: "acc_1",
    bankAccountId,
    date: n.date,
    direction: n.direction === "INCOME" ? "income" : "expense",
    amountPence: n.amountMinor,
    description: n.description,
    source: "bank_feed",
    reconcile: "unreconciled", // bank-feed items arrive uncategorised, needing review
  };
}

/**
 * Content-based dedupe key: same day, amount, direction and (normalised)
 * description is treated as the same transaction regardless of source.
 */
export function dedupeKey(t: Pick<Transaction, "date" | "amountPence" | "direction" | "description">): string {
  const desc = t.description.toLowerCase().replace(/\s+/g, " ").trim();
  return `${t.date}|${t.direction}|${t.amountPence}|${desc}`;
}

/** True when `t` already exists in `existing` (by id or by content). */
export function isDuplicate(t: Transaction, existing: Transaction[]): boolean {
  if (existing.some((e) => e.id === t.id)) return true;
  const key = dedupeKey(t);
  return existing.some((e) => dedupeKey(e) === key);
}

/** Append rows that aren't already present; returns the merged list + counts. */
export function mergeDeduped(
  incoming: Transaction[],
  existing: Transaction[],
): { merged: Transaction[]; added: number; duplicates: number } {
  const seen = new Set(existing.map(dedupeKey));
  const ids = new Set(existing.map((e) => e.id));
  const toAdd: Transaction[] = [];
  let duplicates = 0;
  for (const t of incoming) {
    const key = dedupeKey(t);
    if (ids.has(t.id) || seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    ids.add(t.id);
    toAdd.push(t);
  }
  return { merged: [...toAdd, ...existing], added: toAdd.length, duplicates };
}
