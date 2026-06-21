import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { runReport } from "@/server/reports/service";
import { reportToCsvLines } from "@/lib/reports/csv";
import { reportToPdf } from "@/lib/reports/pdf";

// Server-side export adapters. CSV is streamed line-by-line (no full buffer);
// PDF is rendered server-side and returned as bytes. Both are gated on auth.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const reportType = q.get("type") ?? "";
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  const format = q.get("format") ?? "csv";
  const request = {
    reportType,
    dateRange: { from, to },
    portfolioId: q.get("portfolioId") ?? undefined,
    propertyId: q.get("propertyId") ?? undefined,
    ownerId: q.get("ownerId") ?? undefined,
  };

  let result;
  try {
    result = runReport(request);
  } catch {
    return NextResponse.json({ error: "unknown_report" }, { status: 400 });
  }
  const filename = `${reportType || "report"}_${from}_${to}.${format}`;

  if (format === "pdf") {
    const bytes = reportToPdf(result.model);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // CSV — streamed line by line.
  const encoder = new TextEncoder();
  const lines = reportToCsvLines(result.model);
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const { value, done } = lines.next();
      if (done) controller.close();
      else controller.enqueue(encoder.encode(value));
    },
  });
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
