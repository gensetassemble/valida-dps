import { describe, expect, it, vi } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import ExcelJS from "exceljs";
vi.mock("server-only", () => ({}));
import { normalize } from "@/features/imports/normalize";
import { businessNotes } from "@/features/operations/notes";
import { monitoringXlsx } from "@/features/operations/monitoring-xlsx";
import { monitoringExportNotes } from "@/features/operations/monitoring-export-notes";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

describe("calibration source business notes", () => {
  if (process.env.CALIBRATION_NOTES_EXPORT_QA === "1") it("verifies every restored source remark in the generated report", async () => {
    const root = ".tools/calibration-notes-audit";
    const rows = JSON.parse(await readFile(`${root}/equipment-report-after.json`, "utf8"));
    const plan = JSON.parse(await readFile(`${root}/restore-plan.json`, "utf8")) as {equipment_id:string;source_notes:string}[];
    expect(rows).toHaveLength(79);
    for (const row of rows) expect(businessNotes(row.notes)).toBe(plan.find(p=>p.equipment_id===row.id)!.source_notes.trim());
    const bytes = await monitoringXlsx(rows, "DPS", "2026-11-12");
    await writeFile(`${root}/restored-monitoring.xlsx`, bytes);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(Uint8Array.from(bytes).buffer);
    for (const sheet of book.worksheets) {
      const actual:string[]=[];
      sheet.eachRow(row=>{const cell=row.getCell("V");if(row.number>=9 && cell.master.address===cell.address && cell.value) actual.push(String(cell.value));});
      const expected=rows.filter((row:{portfolio_code:string})=>row.portfolio_code===sheet.name).map((row:{notes:string})=>businessNotes(row.notes));
      expect(actual.sort()).toEqual(expected.sort());
    }
  });
  it("keeps original remarks ahead of technical validation diagnostics", () => {
    expect(normalize("calibrations", { KeteranganAsli: "Patah", CatatanValidasi: "Tag dan sertifikat berulang" }).normalized.notes).toBe("Patah");
    expect(normalize("calibrations", { Catatan: "Alat sudah tiba, menunggu sertifikat", CatatanValidasi: "Tanggal akhir berbeda dari interval tercatat" }).normalized.notes).toBe("Alat sudah tiba, menunggu sertifikat");
    expect(normalize("calibrations", { CatatanValidasi: "Tag dan sertifikat berulang" }).normalized.notes).toBe("");
    expect(normalize("calibrations", { Keterangan: "Jangan dipakai", CatatanValidasi: "staging" }).normalized.notes).toBe("Jangan dipakai");
  });
  it("exports operational remarks while keeping technical provenance out of the report", async () => {
    const remarks = ["Patah", "Alat sudah tiba, hanya menunggu sertifikat 31/08", "Posisi alat tidak tau dimana PTK hanya ada sertifnya saja"];
    const bytes = await monitoringXlsx(remarks.map((note, i) => ({ id: String(i), portfolio_code: "BBR", name: "Hydrometer", notes: `Kandidat aset: identitas belum diverifikasi. | BTB DPS baris ${i + 9} | ${note}` })), "DPS", "2026-11-12");
    const book = new ExcelJS.Workbook(); await book.xlsx.load(Uint8Array.from(bytes).buffer);
    remarks.forEach((note, i) => expect(book.getWorksheet("BBR")!.getCell(`V${9 + i}`).value).toBe(note));
  });
  it("combines equipment and latest calibration remarks through a branch-scoped authorized read", async () => {
    const eq = vi.fn().mockReturnThis(), select = vi.fn().mockReturnThis(), inside = vi.fn().mockReturnThis();
    const limit = vi.fn().mockResolvedValue({ data: [{id:"event-a",notes:"Patah | Menunggu sertifikat"}], error:null });
    const db = {from:vi.fn().mockReturnValue({select,eq,in:inside,limit})} as unknown as SupabaseClient<Database>;
    const rows = [{id:"asset-a",latest_calibration_id:"event-a",notes:"BTB DPS baris 9 | Patah"}, {id:"asset-b",notes:"Alat cadangan"}];
    const result = await monitoringExportNotes(db, rows, "DPS");
    expect(eq).toHaveBeenCalledWith("branch_code","DPS");
    expect(inside).toHaveBeenCalledWith("id",["event-a"]);
    expect(result.map(r=>r.notes)).toEqual(["Patah | Menunggu sertifikat","Alat cadangan"]);
    expect(rows[0].notes).toBe("BTB DPS baris 9 | Patah");
    limit.mockResolvedValue({data:null,error:{message:"denied"}});
    await expect(monitoringExportNotes(db,rows,"DPS")).rejects.toThrow("Keterangan kalibrasi belum dapat dimuat");
  });
  if (process.env.CALIBRATION_NOTES_AUDIT === "1") it("prepares a bounded restoration review from the original source links", async () => {
    const root = ".tools/calibration-notes-audit";
    const rows = JSON.parse(await readFile(`${root}/database-before.json`, "utf8")) as Record<string, string | null>[];
    const comparison = JSON.parse(await readFile(`${root}/source-comparison.json`, "utf8")) as {matches: boolean}[];
    expect(comparison).toHaveLength(rows.length);
    expect(comparison.every(r => r.matches)).toBe(true);
    const candidates = rows.filter(r => r.source_notes?.trim());
    const equipmentIds = new Set(candidates.map(r => r.equipment_id));
    expect(equipmentIds.size).toBe(candidates.length);
    const plan = candidates.map((row): Record<string, string | null> & {new_equipment_notes:string;new_calibration_notes:string;existing_business_notes:string} => {
      const note = row.source_notes!.trim();
      expect(businessNotes(note)).toBe(note);
      const merge = (old: string | null) => old?.includes(note) ? old : [old?.trim(), note].filter(Boolean).join(" | ");
      return { ...row, new_equipment_notes: merge(row.equipment_notes), new_calibration_notes: merge(row.calibration_notes), existing_business_notes: businessNotes(row.equipment_notes) };
    });
    await writeFile(`${root}/restore-plan.json`, JSON.stringify(plan, null, 2));
    await writeFile(`${root}/review.md`, `# Pemulihan Keterangan Kalibrasi\n\n${rows.length} peristiwa dicocokkan dengan workbook; seluruh keterangan cocok. ${plan.length} alat/peristiwa mempunyai keterangan sumber. Tidak mencocokkan berdasarkan tag saja. Catatan yang sudah ada dipertahankan.\n\n| Lembar/baris | Alat | Tag | Keterangan sumber |\n|---|---|---|---|\n` + plan.map(r => `| ${r.source_sheet}/${r.source_row} | ${r.name} | ${r.tag} | ${r.source_notes?.replaceAll("|", " / ")} |`).join("\n"));
    console.log(JSON.stringify({matchedEvents:rows.length,sourceNotes:plan.length,existingBusinessNotes:plan.filter(r=>r.existing_business_notes).length,alreadyPresent:plan.filter(r=>r.new_equipment_notes===r.equipment_notes).length}));
  });
});
