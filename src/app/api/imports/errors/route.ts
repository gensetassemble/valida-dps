import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { z } from "zod";
import { importApiContext } from "@/features/imports/server";
export async function GET(r: NextRequest) {
  const c = await importApiContext(
    r.nextUrl.searchParams.get("branch") || undefined,
    "personnel",
  );
  if (!c)
    return NextResponse.json(
      { error: "Akses hasil pemeriksaan ditolak." },
      { status: 403 },
    );
  const batch = z.uuid().safeParse(r.nextUrl.searchParams.get("batch"));
  if (!batch.success) return new NextResponse(null, { status: 400 });
  const { data: info } = await c.db
    .from("import_batches")
    .select("id")
    .eq("id", batch.data)
    .eq("branch_code", c.branch)
    .maybeSingle();
  if (!info) return new NextResponse(null, { status: 404 });
  const book = new ExcelJS.Workbook();
  const s = book.addWorksheet("Hasil Pemeriksaan");
  s.addRow([
    "Lembar",
    "Baris",
    "Hasil Pemeriksaan",
    "Status Penerapan",
    "Masalah",
    "Catatan Pemeriksaan",
  ]);
  const reviewLabels: Record<string, string> = {
    ready: "Siap diterapkan",
    needs_review: "Perlu diperiksa",
    invalid: "Perlu diperbaiki",
    duplicate: "Dilewati (data ganda)",
    conflict: "Ada data yang berbeda",
  };
  const decisionLabels: Record<string, string> = {
    pending: "Belum diperiksa",
    approved: "Akan diterapkan",
    rejected: "Diabaikan",
    committed: "Sudah diterapkan",
  };
  for (let page = 0; page < 3; page++) {
    const { data, error } = await c.db
      .from("import_rows")
      .select(
        "source_sheet,source_row,review_status,decision,issues,review_note",
      )
      .eq("batch_id", batch.data)
      .order("source_row")
      .order("id")
      .range(page * 1000, page * 1000 + 999);
    if (error) return new NextResponse(null, { status: 503 });
    for (const row of data || [])
      s.addRow([
        row.source_sheet,
        row.source_row,
        reviewLabels[row.review_status] || row.review_status,
        decisionLabels[row.decision] || row.decision,
        JSON.stringify(row.issues),
        row.review_note,
      ]);
    if ((data?.length || 0) < 1000) break;
  }
  s.columns.forEach((col) => (col.width = 28));
  s.getRow(1).font = { bold: true };
  const bytes = await book.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Hasil Pemeriksaan Impor.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
