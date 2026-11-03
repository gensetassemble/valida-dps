import { beforeEach, describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import ExcelJS from "exceljs";
vi.mock("server-only", () => ({}));
import { personnelExportData } from "@/features/operations/personnel-export-data";
import { addPersonnelSheet } from "@/features/operations/personnel-export";
const employees = [
  {
    id: "active",
    full_name: "[CONTOH] Active",
    employment_status: "active",
    is_active: false,
    archived_at: null,
  },
  {
    id: "resigned",
    full_name: "[CONTOH] Resigned",
    employment_status: "inactive",
    is_active: false,
    archived_at: null,
  },
  {
    id: "archived",
    full_name: "[CONTOH] Archived",
    employment_status: "active",
    is_active: true,
    archived_at: "2026-11-01",
  },
];
const rows = employees.map((e) => ({
  employee_id: e.id,
  original_title: "Licence",
  expiry_date: "2027-12-31",
}));
const db = {
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        in: () => ({
          limit: async () => ({
            data: table === "employee_directory" ? employees : [],
            error: null,
          }),
        }),
        single: async () => ({ data: { name: "Denpasar" }, error: null }),
      }),
    }),
  }),
} as unknown as SupabaseClient<Database>;
describe("inactive employees in personnel exports", () => {
  beforeEach(() => vi.clearAllMocks());
  it("excludes resigned and archived employees by default", async () => {
    const result = await personnelExportData(db, rows, "DPS");
    expect(result.rows.map((r) => r.employee_name)).toEqual([
      "[CONTOH] Active",
    ]);
  });
  it("includes inactive on explicit option and visibly marks every exported cell", async () => {
    const result = await personnelExportData(db, rows, "DPS", true);
    expect(result.rows).toHaveLength(3);
    const book = new ExcelJS.Workbook();
    addPersonnelSheet(book, result.rows, "Denpasar", "2026-11-03");
    const saved = await book.xlsx.writeBuffer();
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(saved);
    const out = reopened.worksheets[0];
    let inactive = 0;
    out.eachRow((row) => {
      if (
        String(row.getCell(2).value || "") &&
        String(row.getCell(12).value || "").includes("PERSONIL NONAKTIF")
      ) {
        inactive++;
        for (let col = 1; col <= 14; col++)
          expect(row.getCell(col).fill).toMatchObject({
            type: "pattern",
            fgColor: { argb: "FFFFE4CC" },
          });
      }
    });
    expect(inactive).toBe(2);
  });
});
