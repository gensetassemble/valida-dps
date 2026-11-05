import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  branchLocation,
  longExportDate,
  personnelFilename,
  monitoringOfficials,
} from "@/features/operations/export-context";
import { monitoringXlsx } from "@/features/operations/monitoring-xlsx";
const employee = (full_name: string, position: string) => ({
  full_name,
  position,
  employment_status: "active",
  archived_at: null,
  merged_into_employee_id: null,
});
describe("current export officials and reporting period", () => {
  it("uses Indonesian month, year and branch without repeating the company prefix", () => {
    expect(branchLocation("PT SUCOFINDO Cabang Denpasar")).toBe("Denpasar");
    expect(
      personnelFilename("PT SUCOFINDO Cabang Denpasar", "2026-11-03"),
    ).toBe("Status Kompetensi Personil - Cabang Denpasar_November 2026.xlsx");
    expect(longExportDate("2026-11-03")).toBe("03 November 2026");
  });
  it("follows active office holders and rejects ambiguous assignments", () => {
    const branch = employee("Pejabat Cabang Baru", "Kepala Cabang"),
      head = employee(
        "Pejabat Bidang Baru",
        "Kepala Bidang Inspeksi dan Pengujian",
      );
    const former = {
      ...employee("Pejabat Lama", "Kepala Cabang"),
      employment_status: "inactive",
    };
    expect(monitoringOfficials([former, head, branch])).toEqual({
      acknowledgedBy: branch.full_name,
      preparedBy: head.full_name,
    });
    expect(() =>
      monitoringOfficials([
        branch,
        head,
        { ...branch, full_name: "Pejabat Lain" },
      ]),
    ).toThrow("tepat satu");
    expect(() => monitoringOfficials([former, head])).toThrow("tepat satu");
    expect(() =>
      monitoringOfficials([
        { ...branch, merged_into_employee_id: "old" },
        head,
      ]),
    ).toThrow("tepat satu");
  });
  it("fills dynamic footer names and place/date after every portfolio body", async () => {
    const context = {
      acknowledgedBy: "Pejabat Cabang Baru",
      preparedBy: "Pejabat Bidang Baru",
      location: "Denpasar",
    };
    const bytes = await monitoringXlsx(
      [
        { name: "Alat 1", portfolio_code: "PIK" },
        { name: "Alat 2", portfolio_code: "PIK" },
        { name: "Alat 3", portfolio_code: "BBR" },
      ],
      "DPS",
      "2026-11-03",
      context,
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Uint8Array.from(bytes).buffer);
    for (const sheet of book.worksheets) {
      const offset = sheet.name === "PIK" ? -9 : -10;
      expect(sheet.getCell("A" + (29 + offset)).text).toBe(
        "(Pejabat Cabang Baru)",
      );
      expect(sheet.getCell("R" + (29 + offset)).text).toBe(
        "(Pejabat Bidang Baru)",
      );
      expect(sheet.getCell("R" + (22 + offset)).text).toBe(
        "Denpasar, 03 November 2026",
      );
      expect(sheet.getCell("A" + (30 + offset)).text).toBe("Kepala Unit Kerja");
      expect(sheet.getImages()).toHaveLength(1);
    }
  });
});
