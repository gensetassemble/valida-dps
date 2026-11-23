import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { z } from "zod";
import { importApiContext } from "@/features/imports/server";
import { DOMAINS, FIELDS } from "@/features/imports/normalize";
import { readableXlsx } from "@/lib/xlsx-readability";
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
    const headers = [
      "Portfolio",
      "Nama Pelanggan",
      "Jenis Sertifikat",
      "Nomor Sertifikat",
      "Objek Inspeksi",
      "Nomor Seri (opsional)",
      "Lokasi",
      "Wilayah",
      "Tanggal Terbit",
      "Interval (bulan)",
      "Tanggal Berakhir",
      "Nilai Kontrak (IDR)",
      "Nomor SPK",
      "PIC Perusahaan",
      "Email PIC",
    ];
    const widths = [14.5, 34, 37.625, 51.625, 48.25, 28.5, 36.875, 13.5, 20.625, 21.625, 23.5, 24.625, 32, 27, 27];
    s.columns = headers.map((_, index) => ({ key: `column_${index + 1}`, width: widths[index] }));
    s.addTable({
      name: "UpdateTableSertifikatKlien",
      ref: "A1",
      headerRow: true,
      totalsRow: false,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: headers.map((name) => ({ name })),
      rows: Array.from({ length: 20 }, () => Array(headers.length).fill("")),
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
  const help = book.addWorksheet("Petunjuk");
  help.columns = [
    { header: "Kolom", width: 32 },
    { header: "Penjelasan", width: 70 },
  ];
  Object.entries(FIELDS[domain.data]).forEach(([k, v]) => help.addRow([k, v]));
  help.addRow([
    "Persetujuan",
    "Unggah → staging → pemetaan → persetujuan per baris → konfirmasi impor. Tidak membuat akun login atau memverifikasi dokumen.",
  ]);
  help.addRow([
    "NPP",
    "Simpan lima digit sebagai teks, termasuk angka nol awal.",
  ]);
  help.addRow([
    "Pemetaan referensi",
    "Nama pelanggan/jenis sertifikat pada template klien dipetakan ke master yang sudah ada saat review. AM dan wilayah mengikuti pelanggan; tidak dibuat otomatis dari nama. Gunakan tanggal ISO YYYY-MM-DD atau sel tanggal Excel.",
  ]);
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
