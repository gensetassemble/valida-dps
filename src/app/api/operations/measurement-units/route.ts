import { NextRequest, NextResponse } from "next/server";
import { entityContext, masterClient } from "@/features/master-data/server";
import { historicalUnitSymbols } from "@/features/operations/measurement-units";
export async function GET(request: NextRequest) {
  const { branch } = await entityContext("kalibrasi-alat", request.nextUrl.searchParams.get("branch") || undefined);
  const db = await masterClient();
  const sources = await Promise.all(["equipment_monitoring_records", "calibration_monitoring_records"].map((table) => db.from(table).select("measurement_range").eq("branch_code", branch).not("measurement_range", "is", null).limit(1000)));
  if (sources.some((s) => s.error)) return NextResponse.json({ error: "Satuan historis belum dapat dimuat." }, { status: 503 });
  const values = sources.flatMap((s) => (s.data || []).map((r) => String(r.measurement_range || "")));
  return NextResponse.json({ units: historicalUnitSymbols(values) }, { headers: { "Cache-Control": "private, no-store" } });
}
