"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ds/Modal";
import { Button } from "@/components/ds/Button";
import { trpc } from "@/lib/trpc/client";
import type { NormalizedBankTransaction, ProviderBankAccount } from "@/server/providers/bank-feed";

const BANKS = [
  { id: "barclays", name: "Barclays" },
  { id: "starling", name: "Starling" },
  { id: "monzo", name: "Monzo" },
  { id: "natwest", name: "NatWest" },
  { id: "hsbc", name: "HSBC" },
  { id: "lloyds", name: "Lloyds" },
  { id: "revolut", name: "Revolut" },
];

export interface ConnectedFeed {
  institutionId: string;
  bankName: string;
  connectionId: string;
  consentExpiresAt: string;
  account: ProviderBankAccount;
  transactions: NormalizedBankTransaction[];
}

/**
 * Open Banking connect flow against the dev sandbox: choose bank → consent →
 * pull. We only ever receive an opaque connection token, never credentials.
 */
export function ConnectBankModal({
  open,
  preset,
  onClose,
  onConnected,
}: {
  open: boolean;
  preset?: { institutionId: string; bankName: string } | null;
  onClose: () => void;
  onConnected: (feed: ConnectedFeed) => void;
}) {
  const [step, setStep] = useState<"choose" | "consent">("choose");
  const [bank, setBank] = useState<{ id: string; name: string } | null>(null);
  const [connection, setConnection] = useState<{ connectionId: string; redirectUrl: string; consentExpiresAt: string } | null>(null);

  const connect = trpc.feeds.connect.useMutation();
  const confirm = trpc.feeds.confirm.useMutation();

  function reset() {
    setStep("choose");
    setBank(null);
    setConnection(null);
    connect.reset();
    confirm.reset();
  }

  async function startConsent(b: { id: string; name: string }) {
    setBank(b);
    const res = await connect.mutateAsync({ institutionId: b.id });
    setConnection(res);
    setStep("consent");
  }

  // When opened to reconnect a specific bank, jump straight to its consent.
  useEffect(() => {
    if (open && preset && step === "choose" && !connect.isPending) {
      startConsent({ id: preset.institutionId, name: preset.bankName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset]);

  async function authorise() {
    if (!connection || !bank) return;
    const { account, transactions } = await confirm.mutateAsync({ connectionId: connection.connectionId });
    onConnected({
      institutionId: bank.id,
      bankName: bank.name,
      connectionId: connection.connectionId,
      consentExpiresAt: connection.consentExpiresAt,
      account,
      transactions,
    });
    reset();
  }

  function close() {
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title="Connect a bank feed" size="md">
      {step === "choose" ? (
        <>
          <p className="text-sm text-slate-600">
            Securely connect via open banking (read-only). We never see or store your bank login —
            only an authorisation token you can revoke any time.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BANKS.map((b) => (
              <button
                key={b.id}
                onClick={() => startConsent(b)}
                disabled={connect.isPending}
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50"
              >
                {connect.isPending && bank?.id === b.id ? "Connecting…" : b.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-medium text-slate-800">Authorise {bank?.name}</p>
            <p className="mt-1 text-slate-600">
              You&apos;ll be redirected to {bank?.name} to grant read-only access to your accounts
              and transactions.
            </p>
            <p className="mt-2 break-all font-mono text-xs text-slate-400">{connection?.redirectUrl}</p>
            {connection?.consentExpiresAt ? (
              <p className="mt-2 text-xs text-slate-500">
                Consent valid until {new Date(connection.consentExpiresAt).toLocaleDateString("en-GB")} — you&apos;ll be asked to renew before it lapses.
              </p>
            ) : null}
          </div>
          {confirm.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{confirm.error.message}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={authorise} disabled={confirm.isPending}>
              {confirm.isPending ? "Authorising…" : "Authorise access"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
