import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json(
    { application: "VALIDA", status: "ok", phase: "operational" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
