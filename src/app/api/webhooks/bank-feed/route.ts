import { NextResponse } from "next/server";
import { z } from "zod";

// Webhook endpoint a bank-feed provider calls when new transactions land. A real
// implementation would verify the provider signature, look up the connection by
// its token, then enqueue a feed-poll job (see server/jobs/processors/feed-poll).
// Here we acknowledge the event so the integration surface is in place.

const eventSchema = z.object({
  type: z.string(),
  connectionId: z.string().optional(),
  externalAccountId: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = eventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }
  // eslint-disable-next-line no-console
  console.info(`[bank-feed webhook] ${parsed.data.type} for ${parsed.data.externalAccountId ?? parsed.data.connectionId ?? "?"}`);
  return NextResponse.json({ received: true });
}
