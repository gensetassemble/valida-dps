import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  addPersonnelSheet,
  personnelExportHeaders,
} from "@/features/operations/personnel-export";

describe("personnel monitoring export", () => {
  it("round-trips the 15 report columns, employee type, dates, identifiers, current values and safe links", async () => {
    const book = new ExcelJS.Workbook();
    const url = "https://drive.google.com/drive/folders/synthetic-folder";
    addPersonnelSheet(
      book,
      [
        {
          id: "b",
          employee_name: "[CONTOH] Bravo",
          npp: null,
          employment_category: "PTT_PROJECT",
          original_title: "Lifetime",
          validity_kind: "lifetime",
          notes: "In progress",
          source_folder_url: "javascript:alert(1)",
        },
        {
          id: "a",
          employee_name: "[CONTOH] Alpha",
          npp: "00123",
          employment_category: "PT",
          position: "Inspector 1",
          portfolio_plot: "HMPM / LAB",
          original_title: "Updated licence",
          certificate_number: "000045",
          issue_date: "2025-07-28",
          interval_months: 60,
          expiry_date: "2030-07-29",
          renewal_status: "processing",
          source_folder_url: url,
          notes: "Updated remarks",
        },
        {
          id: "c",
          employee_name: "[CONTOH] Charlie",
          npp: "54321",
          employment_category: "PTT_REGULAR",
          expiry_date: "2026-10-28",
        },
        {
          id: "d",
          employee_name: "[CONTOH] Delta",
          npp: null,
          employment_category: "LS",
          expiry_date: "2026-11-28",
        },
      ],
      "Denpasar",
      "2026-10-29",
    );
    const saved = await book.xlsx.writeBuffer();
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(saved);
    const sheet = reopened.getWorksheet("Kompetensi Personil")!;
    expect(sheet.columnCount).toBe(15);
    expect(sheet.getCell("A3").value).toBe("CABANG : DENPASAR");
    expect(sheet.getCell("H4").value).toBe("MASA BERLAKU");
    for (let col = 1; col <= 15; col++)
      expect(sheet.getCell(col >= 8 && col <= 10 ? 5 : 4, col).value).toBe(
        personnelExportHeaders[col - 1],
      );
    expect(sheet.getCell("B6").value).toBe("PT");
    expect(sheet.getCell("C6").value).toBe("00123");
    expect(sheet.getCell("E6").value).toBe("Inspector 1");
    expect(sheet.getCell("F6").value).toBe("HMPM / LAB");
    expect(sheet.getCell("G6").value).toBe("Updated licence");
    expect(sheet.getCell("H6").value).toEqual(new Date("2025-07-28T00:00:00Z"));
    expect(sheet.getCell("I6").value).toBe(60);
    // Preserve an explicit document date; do not replace it with start + interval.
    expect(sheet.getCell("J6").value).toEqual(new Date("2030-07-29T00:00:00Z"));
    expect(sheet.getCell("K6").value).toMatchObject({ hyperlink: url });
    expect(sheet.getCell("L6").value).toBe("000045");
    expect(sheet.getCell("M6").value).toBe("Updated remarks");
    expect(sheet.getCell("N8").value).toBe(-1);
    expect(sheet.getCell("O6").value).toBe("Sedang Diproses");
    expect(sheet.getCell("N6").alignment.horizontal).toBe("center");
    expect(sheet.getCell("O6").alignment.horizontal).toBe("center");
    expect(sheet.getCell("O7").value).toBe("Tidak perlu perpanjangan");
    expect(sheet.getCell("B7").value).toBe("PTT Project");
    expect(sheet.getCell("C7").value).toBe("Non-NPP");
    expect(sheet.getCell("J7").value).toBe("Seumur hidup");
    expect(sheet.getCell("I7").value).toBeNull();
    expect(sheet.getCell("K7").value).toBeNull();
    expect(sheet.getCell("B8").value).toBe("PTT Regular");
    expect(sheet.getCell("C8").value).toBe("54321");
    expect(sheet.getCell("B9").value).toBe("LS");
    expect(sheet.getCell("C9").value).toBe("Non-NPP");
    expect(sheet.views[0]).toMatchObject({
      state: "frozen",
      xSplit: 4,
      ySplit: 5,
    });
    expect(sheet.pageSetup.printTitlesRow).toBe("1:5");
    expect(sheet.getCell("J8").fill).toMatchObject({
      fgColor: { argb: "FFFEE2E2" },
    });
    expect(sheet.getCell("J9").fill).toMatchObject({
      fgColor: { argb: "FFFEF3C7" },
    });
  });
  it("keeps an empty filtered result exportable and never interprets notes as Excel formulas", () => {
    const empty = new ExcelJS.Workbook();
    addPersonnelSheet(empty, [], "DPS");
    expect(empty.worksheets[0].rowCount).toBe(5);
    const book = new ExcelJS.Workbook();
    addPersonnelSheet(
      book,
      [
        {
          employee_name: '=HYPERLINK("bad")',
          notes: "=1+2",
          issue_date: "2026-02-30",
        },
      ],
      "DPS",
    );
    expect(book.worksheets[0].getCell("D6").type).toBe(
      ExcelJS.ValueType.String,
    );
    expect(book.worksheets[0].getCell("M6").type).toBe(
      ExcelJS.ValueType.String,
    );
    expect(book.worksheets[0].getCell("H6").value).toBeNull();
  });
});
