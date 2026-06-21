import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { completeAuthorization } from "@/server/mtd/service";

// OAuth redirect target. HMRC sends the user back here with ?code & ?state after
// they grant consent on the Government Gateway. We exchange the code for tokens
// (server-side, never touching their password) and return them to the app.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  if (error) return NextResponse.redirect(new URL(`/mtd?hmrc_error=${encodeURIComponent(error)}`, req.url));
  if (!code) return NextResponse.redirect(new URL("/mtd?hmrc_error=missing_code", req.url));

  try {
    await completeAuthorization(session.account.id, code);
    return NextResponse.redirect(new URL("/mtd?hmrc=connected", req.url));
  } catch {
    return NextResponse.redirect(new URL("/mtd?hmrc_error=exchange_failed", req.url));
  }
}
