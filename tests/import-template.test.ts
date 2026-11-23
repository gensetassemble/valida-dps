import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/features/imports/server", () => ({
  importApiContext: vi.fn(async () => ({ branch: "DPS" })),
}));

import { GET } from "@/app/api/imports/template/route";

describe("client certificate import template", () => {
  it("uses the familiar source layout and requested download name", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/imports/template?domain=clients&branch=DPS"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      "Update Table Sertifikat Klien.xlsx",
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(
      Buffer.from(await response.arrayBuffer()) as unknown as Parameters<
        typeof book.xlsx.load
      >[0],
    );
    const sheet = book.getWorksheet("Sertifikat_Klien")!;
    expect(sheet.getCell("A2").text).toContain("Data Archive Sertifikat Klien");
    expect((sheet.getRow(4).values as unknown[]).slice(1)).toEqual([
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
    ]);
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 4 });
    expect(sheet.getColumn(12).numFmt).toBe("#,##0");
  });
});
