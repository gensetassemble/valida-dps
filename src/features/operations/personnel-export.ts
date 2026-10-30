import ExcelJS from "exceljs";
import { businessNotes } from "./notes";
import {
  driveFolder,
  remainingDays,
  todayWita,
  validDate,
} from "@/lib/domain/validity";

export const personnelExportHeaders = [
  "NO.",
  "NPP",
  "NAMA PEGAWAI",
  "JABATAN",
  "PLOT PORTOFOLIO PEGAWAI",
  "JUDUL LISENSI",
  "TERBIT",
  "INTERVAL (BULAN)",
  "BERAKHIR",
  "Link Sertifikat",
  "No. Sertifikat (jika ada)",
  "KETERANGAN",
];
const widths = [6, 16, 30, 32, 25, 48, 18, 20, 18, 30, 32, 48];
const categories: Record<string, string> = {
  PT: "PT",
  PTT_REGULAR: "PTT Regular",
  PTT_PROJECT: "PTT Project",
  LS: "LS",
};
function date(value: unknown) {
  return typeof value === "string" && validDate(value)
    ? new Date(value + "T00:00:00Z")
    : null;
}

export function addPersonnelSheet(
  book: ExcelJS.Workbook,
  rows: Record<string, unknown>[],
  branchName: string,
  today = todayWita(),
) {
  const sheet = book.addWorksheet("Kompetensi Personil");
  sheet.columns = widths.map((width) => ({ width }));
  for (let row = 1; row <= 3; row++) sheet.mergeCells(row, 1, row, 12);
  sheet.getCell("A1").value = "MONITORING KOMPETENSI PERSONIL";
  sheet.getCell("A1").font = { name: "Arial", size: 14, bold: true };
  sheet.getCell("A2").value =
    `Data website per ${today} WITA · Ekspor ulang untuk memperoleh perubahan terbaru`;
  sheet.getCell("A2").font = {
    name: "Arial",
    size: 10,
    color: { argb: "FF475569" },
  };
  sheet.getCell("A3").value =
    "CABANG : " + branchName.toLocaleUpperCase("id-ID");
  sheet.getCell("A3").font = { name: "Arial", size: 10 };
  sheet.getRow(1).height = 25;
  sheet.getRow(2).height = 22;
  sheet.getRow(3).height = 22;
  for (let col = 1; col <= 12; col++) {
    if (col >= 7 && col <= 9) continue;
    sheet.mergeCells(4, col, 5, col);
    sheet.getCell(4, col).value = personnelExportHeaders[col - 1];
  }
  sheet.mergeCells("G4:I4");
  sheet.getCell("G4").value = "MASA BERLAKU";
  for (let col = 7; col <= 9; col++)
    sheet.getCell(5, col).value = personnelExportHeaders[col - 1];
  for (let r = 4; r <= 5; r++) {
    sheet.getRow(r).height = 24;
    for (let col = 1; col <= 12; col++) {
      const cell = sheet.getCell(r, col);
      cell.font = {
        name: "Arial",
        size: 10,
        bold: true,
        color: { argb: "FF0B2545" },
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" },
      };
    }
  }
  const sorted = [...rows].sort(
    (a, b) =>
      String(a.employee_name || "").localeCompare(
        String(b.employee_name || ""),
        "id",
      ) ||
      String(a.original_title || a.certificate_type_name || "").localeCompare(
        String(b.original_title || b.certificate_type_name || ""),
        "id",
      ) ||
      String(a.id).localeCompare(String(b.id)),
  );
  sorted.forEach((record, index) => {
    const lifetime = record.validity_kind === "lifetime";
    const npp = record.npp
      ? String(record.npp)
      : categories[String(record.employment_category)] || "Non-NPP";
    const url = driveFolder(
      typeof record.source_folder_url === "string"
        ? record.source_folder_url
        : null,
    );
    const values = [
      index + 1,
      npp,
      String(record.employee_name || ""),
      String(record.position || ""),
      String(record.portfolio_plot || ""),
      String(record.original_title || record.certificate_type_name || ""),
      date(record.issue_date),
      lifetime
        ? null
        : record.interval_months == null
          ? null
          : Number(record.interval_months),
      lifetime ? "Seumur hidup" : date(record.expiry_date),
      url
        ? { text: url, hyperlink: url, tooltip: "Buka folder sertifikat" }
        : null,
      String(record.certificate_number || ""),
      businessNotes(record.notes),
    ];
    const row = sheet.addRow(values as ExcelJS.CellValue[]);
    row.font = { name: "Arial", size: 10 };
    row.alignment = { vertical: "middle", wrapText: true };
    for (const col of [1, 2, 7, 8, 9])
      row.getCell(col).alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
    row.getCell(2).numFmt = "@";
    row.getCell(11).numFmt = "@";
    row.getCell(7).numFmt = "dd mmm yyyy";
    row.getCell(9).numFmt = "dd mmm yyyy";
    row.getCell(8).numFmt = "0";
    if (url)
      row.getCell(10).font = {
        name: "Arial",
        size: 10,
        color: { argb: "FF0563C1" },
        underline: true,
      };
    const days =
      typeof record.expiry_date === "string" && !lifetime
        ? remainingDays(record.expiry_date, today)
        : null;
    if (days !== null)
      row.getCell(9).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: days < 0 ? "FFFEE2E2" : days <= 90 ? "FFFEF3C7" : "FFE2F0E8",
        },
      };
    if (lifetime)
      row.getCell(9).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDBEAFE" },
      };
    const lines = values.map((value, i) => {
      const text =
        value instanceof Date
          ? ""
          : typeof value === "object" && value && "text" in value
            ? String(value.text)
            : String(value ?? "");
      return text
        .split(/\r?\n/)
        .reduce(
          (sum, line) =>
            sum + Math.max(1, Math.ceil(line.length / (widths[i] - 3))),
          0,
        );
    });
    row.height = Math.max(24, Math.max(...lines) * 14 + 6);
  });
  for (let r = 4; r <= sheet.rowCount; r++)
    for (let c = 1; c <= 12; c++)
      sheet.getCell(r, c).border = {
        top: { style: "thin", color: { argb: "FF334155" } },
        bottom: { style: "thin", color: { argb: "FF334155" } },
        left: { style: "thin", color: { argb: "FF334155" } },
        right: { style: "thin", color: { argb: "FF334155" } },
      };
  if (rows.length)
    sheet.addConditionalFormatting({
      ref: `I6:I${sheet.rowCount}`,
      rules: [
        {
          type: "expression",
          priority: 1,
          formulae: ["AND(ISNUMBER(I6),I6<TODAY())"],
          style: {
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: "FFFEE2E2" },
            },
            font: { color: { argb: "FF991B1B" } },
          },
        },
        {
          type: "expression",
          priority: 2,
          formulae: ["AND(ISNUMBER(I6),I6>=TODAY(),I6<=TODAY()+90)"],
          style: {
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: "FFFEF3C7" },
            },
            font: { color: { argb: "FF92400E" } },
          },
        },
        {
          type: "expression",
          priority: 3,
          formulae: ["AND(ISNUMBER(I6),I6>TODAY()+90)"],
          style: {
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: "FFE2F0E8" },
            },
          },
        },
      ],
    });
  sheet.views = [
    { state: "frozen", xSplit: 3, ySplit: 5, showGridLines: false },
  ];
  // Filter only the data area; the two-level report header stays intact.
  sheet.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: Math.max(5, sheet.rowCount), column: 12 },
  };
  sheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "1:5",
    printArea: `A1:L${Math.max(5, sheet.rowCount)}`,
  };
  sheet.headerFooter.oddFooter = "VALIDA · &P / &N";
}
