"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { normalizeBankTransaction, mergeDeduped } from "@/lib/ingest";
import { computeArrears } from "@/lib/arrears";
import { formatGBP } from "@/lib/money";
import type { BankAccount, Tenancy, Transaction } from "@/lib/types";
import type { SuggestContext } from "@/lib/categorisation";
import { TransactionsActions } from "./TransactionsActions";
import { InputChoiceCards } from "./InputChoiceCards";
import { BankFeedStatus } from "./BankFeedStatus";
import { TransactionsLedger, type LedgerOption } from "./TransactionsLedger";
import { ConnectBankModal, type ConnectedFeed } from "./DataInModals";
import { ImportWizardModal } from "./ImportWizardModal";

export interface WorkspaceProps {
  initialRows: Transaction[];
  initialAccounts: BankAccount[];
  propertyNames: Record<string, string>;
  tenancyNames: Record<string, string>;
  properties: LedgerOption[];
  tenancies: LedgerOption[];
  activeTenancies: Tenancy[];
  activeTenancyByProperty: Record<string, string>;
  suggestContext: SuggestContext;
}

interface Note {
  id: number;
  kind: "payment" | "alert" | "info";
  message: string;
}

let noteSeq = 0;

export function TransactionsWorkspace(props: WorkspaceProps) {
  const [rows, setRows] = useState<Transaction[]>(props.initialRows);
  const [accounts, setAccounts] = useState<BankAccount[]>(props.initialAccounts);
  const [notes, setNotes] = useState<Note[]>([]);
  const [connect, setConnect] = useState<{ open: boolean; preset: { institutionId: string; bankName: string } | null }>({ open: false, preset: null });
  const [importOpen, setImportOpen] = useState(false);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);

  const sync = trpc.feeds.sync.useMutation();
  const simulate = trpc.feeds.simulateWebhook.useMutation();

  const propertyList = props.properties.map((p) => ({ id: p.id, nickname: p.label }));
  const bankOptions: LedgerOption[] = accounts.map((a) => ({ id: a.id, label: `${a.bankName} · ${a.accountName}` }));

  function notify(kind: Note["kind"], message: string) {
    noteSeq += 1;
    const id = noteSeq;
    setNotes((n) => [{ id, kind, message }, ...n].slice(0, 5));
  }
  function dismiss(id: number) {
    setNotes((n) => n.filter((x) => x.id !== id));
  }

  /** Merge a batch of incoming transactions, notifying about payments + arrears. */
  function ingest(incoming: Transaction[], sourceLabel: string) {
    const { merged, added, duplicates } = mergeDeduped(incoming, rows);
    setRows(merged);
    // Real-time notifications for incoming payments.
    for (const t of incoming.filter((t) => t.direction === "income").slice(0, 3)) {
      notify("payment", `Incoming payment ${formatGBP(t.amountPence)} — ${t.description}`);
    }
    notify("info", `${sourceLabel}: ${added} added${duplicates ? `, ${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped` : ""}.`);
    // Missing/late rent alerts, recomputed against the new ledger.
    const active = merged.filter((t) => !t.deactivated);
    const late = props.activeTenancies
      .map((ten) => ({ ten, a: computeArrears(ten, active) }))
      .filter((x) => x.a.status === "in_arrears");
    for (const { ten, a } of late.slice(0, 2)) {
      notify("alert", `Late rent: ${props.propertyNames[ten.propertyId] ?? "a property"} — ${formatGBP(a.balancePence)} behind`);
    }
  }

  function onConnected(feed: ConnectedFeed) {
    const id = `ba_${feed.account.externalId}`;
    const account: BankAccount = {
      id,
      accountId: "acc_1",
      bankName: feed.bankName,
      accountName: feed.account.accountName,
      maskedNumber: feed.account.maskedNumber,
      status: "connected",
      lastSyncedAt: "2026-06-20T12:00:00.000Z",
      consentExpiresAt: feed.consentExpiresAt,
      connectionId: feed.connectionId,
      externalAccountId: feed.account.externalId,
    };
    // Update an existing account for this bank (reconnect) or add a new one.
    setAccounts((prev) => {
      const idx = prev.findIndex((a) => a.bankName === feed.bankName);
      if (idx >= 0) { const copy = [...prev]; copy[idx] = { ...copy[idx], ...account, id: copy[idx].id }; return copy; }
      return [...prev, account];
    });
    const bankAccountId = accounts.find((a) => a.bankName === feed.bankName)?.id ?? id;
    ingest(feed.transactions.map((t) => normalizeBankTransaction(t, bankAccountId)), `Connected ${feed.bankName}`);
    setConnect({ open: false, preset: null });
  }

  async function onSync(acc: BankAccount) {
    if (!acc.externalAccountId) return;
    setBusyAccountId(acc.id);
    try {
      const txs = await sync.mutateAsync({ externalAccountId: acc.externalAccountId, since: acc.lastSyncedAt?.slice(0, 10) });
      ingest(txs.map((t) => normalizeBankTransaction(t, acc.id)), `Synced ${acc.bankName}`);
    } finally {
      setBusyAccountId(null);
    }
  }

  async function onSimulate(acc: BankAccount) {
    if (!acc.externalAccountId) return;
    setBusyAccountId(acc.id);
    try {
      const t = await simulate.mutateAsync({ externalAccountId: acc.externalAccountId });
      ingest([normalizeBankTransaction(t, acc.id)], `${acc.bankName} webhook`);
    } finally {
      setBusyAccountId(null);
    }
  }

  function onReconnect(acc: BankAccount) {
    setConnect({ open: true, preset: { institutionId: acc.bankName.toLowerCase(), bankName: acc.bankName } });
  }

  return (
    <>
      {/* Notifications */}
      {notes.length ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
          {notes.map((n) => (
            <div key={n.id} className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-md ${n.kind === "alert" ? "border-amber-200 bg-amber-50 text-amber-900" : n.kind === "payment" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700"}`}>
              <span aria-hidden>{n.kind === "alert" ? "⚠️" : n.kind === "payment" ? "💰" : "✓"}</span>
              <span className="flex-1">{n.message}</span>
              <button onClick={() => dismiss(n.id)} aria-label="Dismiss" className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav className="mb-1 flex items-center gap-1.5 text-sm text-slate-500" aria-label="Breadcrumb">
            <Link href="/dashboard" className="hover:text-slate-700">Home</Link>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-700">Transactions</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Transactions</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Every penny in and out — categorised against the SA105 tax boxes.</p>
        </div>
        <TransactionsActions onImport={() => setImportOpen(true)} onConnect={() => setConnect({ open: true, preset: null })} />
      </div>

      {rows.length === 0 ? (
        <>
          <p className="text-sm text-slate-500">Get started by bringing your transactions in — connect a bank feed for live data, or upload a spreadsheet of your history.</p>
          <InputChoiceCards onConnect={() => setConnect({ open: true, preset: null })} onImport={() => setImportOpen(true)} />
        </>
      ) : (
        <>
          <BankFeedStatus
            accounts={accounts}
            onConnect={() => setConnect({ open: true, preset: null })}
            onReconnect={onReconnect}
            onSync={onSync}
            onSimulate={onSimulate}
            busyAccountId={busyAccountId}
          />
          <TransactionsLedger
            rows={rows}
            setRows={setRows}
            propertyNames={props.propertyNames}
            tenancyNames={props.tenancyNames}
            properties={props.properties}
            tenancies={props.tenancies}
            bankAccounts={bankOptions}
            activeTenancies={props.activeTenancies}
            activeTenancyByProperty={props.activeTenancyByProperty}
            suggestContext={props.suggestContext}
          />
        </>
      )}

      <ConnectBankModal open={connect.open} preset={connect.preset} onClose={() => setConnect({ open: false, preset: null })} onConnected={onConnected} />
      <ImportWizardModal open={importOpen} onClose={() => setImportOpen(false)} onImport={(r) => ingest(r, "Spreadsheet import")} existing={rows} properties={propertyList} />
    </>
  );
}
