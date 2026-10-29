import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { addMonitoringSheets } from "@/features/operations/monitoring-export";
import { addPersonnelSheet } from "@/features/operations/personnel-export";
import { personnelExportData } from "@/features/operations/personnel-export-data";
import {
  entityContext,
  listRecords,
  masterClient,
  type QueryParams,
  type DataRow,
} from "@/features/master-data/server";
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(
    request.nextUrl.searchParams,
  ) as QueryParams & { entity?: string };
  if (
    ![
      "sertifikat-klien",
      "kompetensi-personil",
      "kalibrasi-alat",
      "riwayat-kalibrasi",
    ].includes(params.entity || "")
  )
    return new NextResponse(null, { status: 400 });
  const c = await entityContext(params.entity!, params.branch).catch(
    () => null,
  );
  if (!c)
    return NextResponse.json(
      { error: "Akses ekspor ditolak." },
      { status: 403 },
    );
  const rows: DataRow[] = [];
  for (let page = 1; page <= 10; page++) {
    const data = await listRecords(
      c.entity,
      c.branch,
      { ...params, page: String(page) },
      undefined,
      1000,
    );
    if (data.total > 10000)
      return NextResponse.json(
        {
          error: "Lebih dari 10.000 rekaman; persempit filter sebelum ekspor.",
        },
        { status: 413 },
      );
    rows.push(
      ...data.rows.map((row) =>
        c.entity.key === "kompetensi-personil"
          ? row
          : Object.fromEntries(
              Object.entries(row).map(([key, value]) => [
                key,
                data.labels[key]?.[String(value)] || value,
              ]),
            ),
      ),
    );
    if (rows.length >= data.total || !data.rows.length) break;
  }
  const book = new ExcelJS.Workbook();
  book.creator = "VALIDA";
  if (c.entity.key === "kalibrasi-alat")
    addMonitoringSheets(book, rows, c.branch);
  else if (c.entity.key === "kompetensi-personil") {
    try {
      const data = await personnelExportData(
        await masterClient(),
        rows,
        c.branch,
      );
      addPersonnelSheet(book, data.rows, data.branchName);
    } catch {
      return NextResponse.json(
        {
          error:
            "Data pendukung kompetensi belum dapat dimuat. Silakan coba ekspor kembali.",
        },
        { status: 503 },
      );
    }
  } else {
    const sheet = book.addWorksheet("Data sesuai akses");
    sheet.columns = c.entity.columns.map((key) => ({
      header: key,
      key,
      width: 24,
    }));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0B2545" },
    };
    for (const row of rows)
      sheet.addRow(
        Object.fromEntries(
          c.entity.columns.map((k) => [
            k,
            row[k] === null ? "" : String(row[k] ?? ""),
          ]),
        ),
      );
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = {
      from: "A1",
      to: { row: 1, column: c.entity.columns.length },
    };
  }
  const bytes = await book.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="' + c.entity.key + '-sesuai-akses.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
