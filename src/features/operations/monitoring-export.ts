import ExcelJS from "exceljs";
import {
  monitoringColumns,
  monitoringHeaders,
  monitoringValue,
} from "./monitoring";

export function addMonitoringSheets(
  book: ExcelJS.Workbook,
  rows: Record<string, unknown>[],
  branch: string,
) {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const code = String(row.portfolio_code || "Belum dipetakan");
    groups.set(code, [...(groups.get(code) || []), row]);
  }
  if (!groups.size) groups.set("Monitoring", []);
  const used = new Set<string>();
  for (const [portfolio, records] of groups) {
    const base =
      portfolio.replace(/[\\/*?:[\]]/g, "_").slice(0, 25) || "Monitoring";
    let name = base,
      suffix = 1;
    while (used.has(name.toLowerCase())) name = base + " " + suffix++;
    used.add(name.toLowerCase());
    const sheet = book.addWorksheet(name);
    sheet.columns = [
      { width: 6 },
      ...monitoringColumns.map(([key]) => ({
        width: key === "name" ? 28 : key === "correction_factor" ? 24 : 19,
      })),
    ];
    sheet.mergeCells(1, 1, 1, 21);
    sheet.getCell(1, 1).value = "LAPORAN MONITORING KALIBRASI / PERIJINAN";
    sheet.getCell(1, 1).font = { bold: true, size: 14 };
    sheet.mergeCells(2, 1, 2, 21);
    sheet.getCell(2, 1).value = `Cabang ${branch} · Portofolio ${portfolio}`;
    monitoringHeaders.forEach((cells, index) => {
      for (const [col, label, span, rowSpan] of cells) {
        const row = index + 4;
        if (span > 1 || rowSpan > 1)
          sheet.mergeCells(row, col, row + rowSpan - 1, col + span - 1);
        const cell = sheet.getCell(row, col);
        cell.value = label;
        cell.font = { bold: true, size: 10 };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: col === 12 || col === 13 ? "FFFFFF00" : "FFEFF4F8" },
        };
      }
      sheet.getRow(index + 4).height = 26;
    });
    records.forEach((record, index) => {
      const values = monitoringColumns.map(([key]) =>
        monitoringValue(record, key),
      );
      const row = sheet.addRow([index + 1, ...values]);
      const lines = Math.max(
        ...values.map((value) => value.split(/\r?\n/).length),
      );
      row.height = Math.min(409, Math.max(54, lines * 14));
      row.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      row.font = { size: 10 };
    });
    for (let row = 4; row <= sheet.rowCount; row++)
      for (let col = 1; col <= 21; col++)
        sheet.getCell(row, col).border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
    sheet.views = [{ state: "frozen", xSplit: 3, ySplit: 6 }];
    sheet.pageSetup = {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "1:6",
    };
    sheet.headerFooter.oddFooter = "VALIDA · &P / &N";
  }
}
