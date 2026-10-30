import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/guards";
import { masterClient } from "@/features/master-data/server";
import { calibrationRequestHtml } from "@/features/workflows/print-form";
import { resolveRequestIdentity } from "@/features/workflows/request-identity";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  await requireActiveUser();
  const id = z.uuid().safeParse(request.nextUrl.searchParams.get("id"));
  if (!id.success) return new NextResponse(null, { status: 400 });
  const db = await masterClient();
  const { data } = await db
    .from("calibration_requests")
    .select("*")
    .eq("id", id.data)
    .maybeSingle();
  if (!data) return new NextResponse(null, { status: 404 });
  const form = await resolveRequestIdentity(db, data);
  if (request.nextUrl.searchParams.get("format") === "pdf") {
    const { calibrationRequestPdf, calibrationRequestFilename } = await import("@/features/workflows/request-pdf");
    const pdf = await calibrationRequestPdf(form);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${calibrationRequestFilename(data)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'; base-uri 'none'",
      },
    });
  }
  return new NextResponse(calibrationRequestHtml(form), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'",
      ...(request.nextUrl.searchParams.get("download") === "1"
        ? { "Content-Disposition": "attachment; filename=FOR-SCI-UMA-197.html" }
        : {}),
    },
  });
}
