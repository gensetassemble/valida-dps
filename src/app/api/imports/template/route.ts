import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { z } from "zod";
import { importApiContext } from "@/features/imports/server";
import { DOMAINS, FIELDS } from "@/features/imports/normalize";
import { readableXlsx } from "@/lib/xlsx-readability";
import {
  CLIENT_CERTIFICATE_TEMPLATE_COLUMNS,
  CLIENT_TEMPLATE_EXAMPLE_MARKER,
} from "@/features/imports/client-template";
export async function GET(r: NextRequest) {
  if (
    !(await importApiContext(r.nextUrl.searchParams.get("branch") || undefined))
  )
    return NextResponse.json(
      { error: "Akses impor ditolak." },
      { status: 403 },
    );
  const domain = z
    .enum(DOMAINS)
    .safeParse(r.nextUrl.searchParams.get("domain"));
  if (!domain.success) return new NextResponse(null, { status: 400 });
  const book = new ExcelJS.Workbook();
  book.creator = "VALIDA";
  const isClientTemplate = domain.data === "clients";
  const s = book.addWorksheet(isClientTemplate ? "Sertifikat_Klien" : "Data");
  if (isClientTemplate) {
    const headers = CLIENT_CERTIFICATE_TEMPLATE_COLUMNS.map((column) => column.header);
    const widths = CLIENT_CERTIFICATE_TEMPLATE_COLUMNS.map((column) => column.width);
    const example: Record<string, string | number | Date> = {
      portfolio_code: "KSP",
      client_name: `${CLIENT_TEMPLATE_EXAMPLE_MARKER} PT Pelanggan Contoh`,
      certificate_type_name: "Sertifikat Contoh",
      certificate_number: "CONTOH-CERT-001",
      object_type: "Objek inspeksi contoh",
      object_serial: "SN-CONTOH-001",
      installation_location: "Denpasar",
      work_area_name: "Bali",
      issue_date: new Date("2026-01-01T00:00:00.000Z"),
      interval_months: 12,
      expiry_date: new Date("2027-01-01T00:00:00.000Z"),
      previous_order_value: 1000000,
      order_reference: "CONTOH-SPK-001",
      pic_name: "Nama PIC Contoh",
      pic_email: "contoh@example.invalid",
    };
    s.columns = headers.map((_, index) => ({ key: `column_${index + 1}`, width: widths[index] }));
    s.addTable({
      name: "UpdateTableSertifikatKlien",
      ref: "A1",
      headerRow: true,
      totalsRow: false,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: headers.map((name) => ({ name })),
      rows: [
        CLIENT_CERTIFICATE_TEMPLATE_COLUMNS.map((column) => example[column.sourceKey]),
        ...Array.from({ length: 19 }, () => Array(headers.length).fill("")),
      ],
    });
    s.getRow(1).height = 36.75;
    s.getRow(1).eachCell((cell) => {
      cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B6B66" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFFFFFFF" } },
        left: { style: "thin", color: { argb: "FFFFFFFF" } },
        bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
        right: { style: "thin", color: { argb: "FFFFFFFF" } },
      };
    });
    for (let row = 2; row <= 21; row++) {
      s.getRow(row).height = 22;
      s.getRow(row).alignment = { vertical: "middle" };
    }
    s.getRow(2).font = {
      name: "Arial",
      size: 10,
      italic: true,
      color: { argb: "FF7C2D12" },
    };
    s.getRow(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEF3C7" },
    };
    s.getColumn(9).numFmt = "dd mmm yyyy";
    s.getColumn(11).numFmt = "dd mmm yyyy";
    s.getColumn(12).numFmt = "#,##0";
    s.views = [{ state: "frozen", ySplit: 1, zoomScale: 85, showGridLines: false }];
    s.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "1:1",
    };
  } else {
    s.columns = Object.keys(FIELDS[domain.data]).map((key) => ({
      header: key === "npp" ? "NPP" : key,
      key,
      width: 26,
    }));
  }
  const headerRow = 1;
  s.getRow(headerRow).font = { bold: true, color: { argb: "FFFFFFFF" } };
  if (!isClientTemplate) s.getRow(headerRow).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0B2545" },
  };
  if (!isClientTemplate) s.views = [{ state: "frozen", ySplit: 1 }];
  if (!isClientTemplate) {
    const help = book.addWorksheet("Petunjuk");
    help.columns = [
      { header: "Kolom", width: 32 },
      { header: "Penjelasan", width: 70 },
    ];
    Object.entries(FIELDS[domain.data]).forEach(([k, v]) => help.addRow([k, v]));
    help.addRow([
      "Urutan penggunaan",
      "Unggah file → periksa kecocokan data → periksa perubahan → terapkan pembaruan. Proses ini tidak membuat akun login atau memverifikasi dokumen resmi.",
    ]);
    help.addRow([
      "NPP",
      "Simpan lima digit sebagai teks, termasuk angka nol awal.",
    ]);
    help.addRow([
      "Kecocokan data",
      "Nama pelanggan dan jenis sertifikat dicocokkan dengan data yang sudah tersedia. Gunakan tanggal ISO YYYY-MM-DD atau sel tanggal Excel.",
    ]);
  }
  if (!isClientTemplate) s.getColumn(1).numFmt = "@";
  const b = await readableXlsx(new Uint8Array(await book.xlsx.writeBuffer()));
  return new NextResponse(new Uint8Array(b), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": isClientTemplate
        ? 'attachment; filename="Update Table Sertifikat Klien.xlsx"'
        : 'attachment; filename="template-' + domain.data + '.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
