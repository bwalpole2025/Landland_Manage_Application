import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, AuthError } from "@/server/auth/service";
import { createSessionToken, setSessionCookie } from "@/server/auth/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().optional(),
});

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: "Incorrect email or password.",
  EMAIL_NOT_VERIFIED: "Please verify your email address before signing in.",
  TOTP_REQUIRED: "Enter your two-factor code.",
  TOTP_INVALID: "That two-factor code is not valid.",
  NO_ACCOUNT: "Your user has no account. Contact support.",
};

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const { userId, activeAccountId } = await authenticate(parsed.data);
    const token = await createSessionToken(userId, activeAccountId);
    setSessionCookie(token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === "TOTP_REQUIRED" ? 401 : 400;
      return NextResponse.json({ error: messages[err.code], code: err.code }, { status });
    }
    throw err;
  }
}
