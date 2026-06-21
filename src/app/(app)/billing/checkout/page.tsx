import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { CheckoutForm } from "@/components/billing/CheckoutForm";
import { getSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

// In-app stand-in for the payment provider's hosted checkout page. A real
// integration redirects to the provider's own domain instead.
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: { session?: string; return?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "owner") redirect("/settings");

  const sessionId = searchParams.session;
  if (!sessionId) redirect("/settings");

  return (
    <>
      <PageHeader
        title="Confirm your subscription"
        description="Secure checkout — your card is handled by our payment provider, not by Landland."
      />
      <CheckoutForm sessionId={sessionId} returnUrl={searchParams.return ?? "/settings?subscribed=1"} />
    </>
  );
}
