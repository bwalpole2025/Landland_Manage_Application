"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui";
import { planPriceLabel } from "@/lib/subscription";

/**
 * Stand-in for a payment provider's HOSTED checkout (e.g. Stripe Checkout). The
 * card fields here are illustrative only — in a real integration they are the
 * provider's iframed hosted fields and the PAN never touches our servers. On
 * submit we send only the session id + explicit terms acceptance to our backend.
 */
export function CheckoutForm({ sessionId, returnUrl }: { sessionId: string; returnUrl: string }) {
  const router = useRouter();
  const complete = trpc.billing.completeCheckout.useMutation();
  const [terms, setTerms] = useState(false); // never pre-checked
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setError(null);
    try {
      await complete.mutateAsync({ sessionId, termsAccepted: terms });
      router.push(returnUrl || "/settings?subscribed=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment could not be completed.");
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
        <p className="text-sm font-semibold text-slate-800">Landland Pro</p>
        <p className="text-2xl font-bold tracking-tight text-slate-900">{planPriceLabel()}</p>
        <p className="mt-1 text-xs text-slate-500">
          You won&apos;t be charged until your free trial ends. Cancel any time before then.
        </p>

        {/* Illustrative hosted fields — provider-rendered in production. */}
        <div className="mt-4 space-y-3 opacity-90">
          <MockField label="Card number" placeholder="4242 4242 4242 4242" />
          <div className="grid grid-cols-2 gap-3">
            <MockField label="Expiry" placeholder="12 / 30" />
            <MockField label="CVC" placeholder="123" />
          </div>
          <p className="text-[11px] text-slate-400">
            🔒 Card details are handled by our payment provider&apos;s secure hosted fields. Landland never
            sees or stores your full card number.
          </p>
        </div>

        <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
          />
          <span>
            I agree to the{" "}
            <a href="/help" className="font-medium text-brand-600 hover:underline">
              Terms of Service
            </a>{" "}
            and authorise Landland to charge my card when the free trial ends.
          </span>
        </label>

        {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <div className="mt-4 flex items-center justify-between">
          <a href={returnUrl || "/settings"} className="text-sm text-slate-500 hover:underline">
            Cancel
          </a>
          <Button onClick={pay} disabled={!terms || complete.isPending}>
            {complete.isPending ? "Processing…" : "Confirm subscription"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MockField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <input
        className="input w-full"
        placeholder={placeholder}
        // Illustrative only — disabled so no real card data is entered/handled.
        disabled
      />
    </div>
  );
}
