import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { StatusBadge } from "@/components/ui/status-badge";
import { operationalValidity, validityDisplayLabel } from "@/lib/domain/validity";
import { personnelFilterOptions } from "@/features/operations/personnel-filter-options";
import { equipmentPortfolioSummary, managementSummary, withManagementSummary } from "@/features/operations/management-summary";
import { monitoringXlsx } from "@/features/operations/monitoring-xlsx";

describe("Not Recorded display status", () => {
  it("renames visible labels and accessibility text while keeping existing filter keys working", () => {
    for (const old of ["Tanggal Belum Diisi", "Tanggal belum diisi", "Tanpa tanggal", "Not Recorded"]) {
      expect(validityDisplayLabel(old)).toBe("Not Recorded");
      const badge = renderToStaticMarkup(createElement(StatusBadge, { value: old }));
      expect(badge).toContain('aria-label="Not Recorded"');
      expect(badge).not.toMatch(/Tanggal [Bb]elum|Tanpa tanggal/);
    }
    expect(personnelFilterOptions.find(g => g.key === "validity")!.options).toContainEqual(["Tanggal Belum Diisi", "Not Recorded"]);
    expect(operationalValidity(null)).toBe("Tanggal Belum Diisi");
    expect(validityDisplayLabel("Expired")).toBe("Expired");
  });
  it("groups N/A and missing dates under Not Recorded without treating non-significant as expired or overriding valid dates", async () => {
    const today = "2026-11-12";
    const rows = [
      { id: "na", portfolio_code: "LAB", latest_due_date: "N/A", significant_yes: "-", significant_no: "√", latest_calibration_date: "N/A" },
      { id: "empty", portfolio_code: "PIK", latest_due_date: null },
      { id: "valid", portfolio_code: "LAB", latest_due_date: "2027-11-12", significant_yes: "-", significant_no: "√" },
      { id: "expired", portfolio_code: "LAB", latest_due_date: "2026-11-11" },
    ];
    const total = managementSummary(rows, "kalibrasi-alat", today);
    expect(total.buckets.find(b => b.status === "Not Recorded")!.count).toBe(2);
    expect(total.buckets.find(b => b.status === "Aman")!.count).toBe(1);
    expect(total.buckets.find(b => b.status === "Expired")!.count).toBe(1);
    expect(equipmentPortfolioSummary(rows, today).map(p => p.buckets[5].count)).toEqual([1, 1]);
    const bytes = await withManagementSummary(await monitoringXlsx(rows, "DPS", today), { entity: "kalibrasi-alat", rows, branch: "DPS", today });
    const book = new ExcelJS.Workbook(); await book.xlsx.load(Uint8Array.from(bytes).buffer);
    expect(book.worksheets[0].getCell("B17").value).toBe("Not Recorded");
    expect(book.worksheets[0].getCell("J35").value).toBe("Not Recorded");
    const zip = await JSZip.loadAsync(bytes);
    const chart = await zip.file("xl/charts/valida-validity.xml")!.async("string");
    expect(chart).toContain("Not Recorded");
    expect(chart).not.toContain("Tanggal Belum Diisi");
    // N/A in the source report stays N/A; the status label is not substituted into dates/specifications.
    expect(book.getWorksheet("LAB")!.getCell("L9").value).toBe("N/A");
  });
});
