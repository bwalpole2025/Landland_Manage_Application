import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptInvitation, InvitationError } from "@/server/auth/invitations";
import { createSessionToken, setSessionCookie } from "@/server/auth/session";
const schema = z.object({
  token: z.string().min(1),
  // Required only for new invitees (validated in the service).
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  password: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const { userId, activeAccountId } = await acceptInvitation(parsed.data);
    const token = await createSessionToken(userId, activeAccountId);
    setSessionCookie(token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof InvitationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
