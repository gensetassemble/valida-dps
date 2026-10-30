import { NextResponse } from "next/server";
import { APPLICATION_RELEASE } from "@/lib/version";
export function GET() {
  return NextResponse.json(
    { application: "VALIDA", status: "ok", phase: "operational", release: APPLICATION_RELEASE, commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
