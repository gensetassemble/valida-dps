import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { z } from "zod";
import { importApiContext } from "@/features/imports/server";
import { DOMAINS, FIELDS } from "@/features/imports/normalize";
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
  const s = book.addWorksheet("Data");
  s.columns = Object.keys(FIELDS[domain.data]).map((key) => ({
    header: key === "npp" ? "NPP" : key,
    key,
    width: 26,
  }));
  if (domain.data === "clients")
    s.columns = [
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
      "Account Manager (AM)",
      "Nomor SPK",
      "Cabang Operasional",
    ].map((header) => ({ header, width: 27 }));
  s.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  s.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0B2545" },
  };
  s.views = [{ state: "frozen", ySplit: 1 }];
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
  s.getColumn(1).numFmt = "@";
  const b = await book.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(b), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="template-' + domain.data + '.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
