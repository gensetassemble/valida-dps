import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/features/imports/server", () => ({
  importApiContext: vi.fn(async () => ({ branch: "DPS" })),
}));

import { GET } from "@/app/api/imports/template/route";
import {
  CLIENT_CERTIFICATE_TEMPLATE_COLUMNS,
} from "@/features/imports/client-template";
import { OPERATIONAL_ENTITIES } from "@/features/operations/entities";

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
    expect((sheet.getRow(1).values as unknown[]).slice(1)).toEqual([
      "Portofolio",
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
    expect(book.worksheets.map((worksheet) => worksheet.name)).toEqual([
      "Sertifikat_Klien",
    ]);
    expect(sheet.getCell("B2").text).toContain("[CONTOH - TIDAK DIIMPOR]");
    expect(sheet.getCell("A3").value).toBe("");
    expect(sheet.getCell("A1").value).not.toBe("client_name");
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.getTable("UpdateTableSertifikatKlien")).toBeDefined();
    expect(sheet.rowCount).toBe(21);
    expect(sheet.getColumn(12).numFmt).toBe("#,##0");
    expect(sheet.getRow(2).font.italic).toBe(true);
  });

  it("keeps the manual client form aligned with the template", () => {
    const entity = OPERATIONAL_ENTITIES["sertifikat-klien"];
    const formFields = entity.fields.filter((field) => !field.formHidden);
    const templateFormColumns = CLIENT_CERTIFICATE_TEMPLATE_COLUMNS.filter(
      (column) => column.formKey,
    );
    expect(formFields.map((field) => field.key)).toEqual(
      templateFormColumns.map((column) => column.formKey),
    );
    expect(formFields.map((field) => field.label)).toEqual(
      templateFormColumns.map((column) => column.header),
    );
    expect(entity.fields.some((field) => ["inspector_employee_id", "inspection_date", "previous_certificate_id"].includes(field.key))).toBe(false);
    expect(
      CLIENT_CERTIFICATE_TEMPLATE_COLUMNS.filter((column) => !column.formKey)
        .map((column) => column.header),
    ).toEqual(["PIC Perusahaan", "Email PIC"]);
  });
});
