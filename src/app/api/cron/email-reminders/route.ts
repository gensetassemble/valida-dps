import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runEmailWorker } from "@/lib/microsoft/email-worker";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const expected = secret ? Buffer.from(`Bearer ${secret}`) : null;
  const received = Buffer.from(request.headers.get("authorization") || "");
  if (!expected || secret!.length < 32 || received.length !== expected.length || !timingSafeEqual(received, expected))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runEmailWorker({ schedule: true }), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Worker email belum selesai. Periksa riwayat pengiriman sebelum mencoba ulang." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
