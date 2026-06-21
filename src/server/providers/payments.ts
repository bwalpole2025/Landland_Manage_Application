// Payment provider — abstraction for card billing via the provider's HOSTED
// checkout. We never see or store raw card data (PAN/CVC): createCheckout hands
// the user off to a hosted page where the provider collects and tokenises the
// card; we only ever receive a session id back and a display-only summary
// (brand + last 4). MockPaymentProvider stands in for a real Stripe/Adyen
// integration so the flow is exercisable without a payment account.

import { randomBytes } from "node:crypto";

export interface CheckoutParams {
  accountId: string;
  customerEmail: string;
  /** Where the hosted page returns the user after completion. */
  returnUrl: string;
  /** Subscription must not charge until this date (end of trial); null = now. */
  trialEndsAt: string | null;
}

export interface CheckoutSession {
  id: string;
  /** Hosted checkout URL to send the user to. */
  url: string;
}

export interface PaymentMethodSummary {
  brand: string;
  last4: string;
}

export interface CheckoutResult {
  status: "complete" | "open" | "expired";
  paymentMethod?: PaymentMethodSummary;
  customerId?: string;
  subscriptionId?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(params: CheckoutParams): Promise<CheckoutSession>;
  retrieveCheckout(sessionId: string): Promise<CheckoutResult>;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async createCheckout(params: CheckoutParams): Promise<CheckoutSession> {
    const id = `cs_mock_${params.accountId}_${randomBytes(5).toString("hex")}`;
    // Relative URL to our in-app hosted-checkout stand-in. A real provider
    // returns an absolute URL to its own domain.
    const url = `/billing/checkout?session=${encodeURIComponent(id)}&return=${encodeURIComponent(params.returnUrl)}`;
    return { id, url };
  }

  async retrieveCheckout(sessionId: string): Promise<CheckoutResult> {
    // The mock treats any session it issued as a completed hosted checkout.
    // A real implementation verifies completion via a signed webhook before
    // trusting it. The card details below are the provider's display summary —
    // the only card information our system ever receives.
    return {
      status: "complete",
      paymentMethod: { brand: "Visa", last4: "4242" },
      customerId: `cus_${sessionId.slice(8, 20)}`,
      subscriptionId: `sub_${sessionId.slice(8, 20)}`,
    };
  }
}

// A real implementation, e.g. Stripe Checkout in subscription mode with a trial:
//
// export class StripePaymentProvider implements PaymentProvider {
//   readonly name = "stripe";
//   async createCheckout(p: CheckoutParams): Promise<CheckoutSession> {
//     const session = await stripe.checkout.sessions.create({
//       mode: "subscription",
//       customer_email: p.customerEmail,
//       line_items: [{ price: env.stripePriceId, quantity: 1 }],
//       subscription_data: p.trialEndsAt
//         ? { trial_end: Math.floor(new Date(p.trialEndsAt).getTime() / 1000) }
//         : undefined,
//       success_url: p.returnUrl,
//       cancel_url: p.returnUrl,
//     });
//     return { id: session.id, url: session.url! };
//   }
//   async retrieveCheckout(id: string): Promise<CheckoutResult> { /* verify + read */ }
// }
