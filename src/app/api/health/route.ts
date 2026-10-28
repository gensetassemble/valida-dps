import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json(
    { application: "VALIDA", status: "ok", phase: "master-data" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
