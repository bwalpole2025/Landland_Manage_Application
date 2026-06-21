// GDPR data export — returns a full JSON snapshot of the account's data as a
// downloadable attachment. Owner-gated.

import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { exportAccountData } from "@/server/security/gdpr";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Only the account owner can export data." }, { status: 403 });
  }

  const data = await exportAccountData(prisma, session.account.id);
  const filename = `propmanage-export-${session.account.id}-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
