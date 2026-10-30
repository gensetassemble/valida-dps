import { mkdir, writeFile } from "node:fs/promises";
import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { calibrationRequestPdf, calibrationRequestFilename } from "@/features/workflows/request-pdf";

const request = {
  id: "ab000000-0000-4000-8000-000000000001",
  request_number: "[CONTOH] KAL-DPS/2026/001",
  unit_name: "Denpasar", quantity: 1,
  laboratory: "[CONTOH] Laboratorium Kalibrasi", resolution_class: "0.0005 kg/l",
  estimated_days: 7, estimated_cost: 1250000,
  requester_name: "[CONTOH] Koordinator Operasional", supervisor_name: "[CONTOH] Kepala Bidang",
  requester_npp: "04125", created_at: "2026-10-30T18:00:00Z",
  notes: "[CONTOH] Kalibrasi rutin sesuai jadwal portofolio.",
  equipment_snapshot: { name: "[CONTOH] Hydrometer", tag: "CONTOH-001", serial: "CONTOH-SN001", location: "Denpasar", brand: "[CONTOH] Merek", measurement_range: "0.990 - 1.040 kg/l; ±0.005; 23 °C; 5000 Ω" },
};
describe("filled calibration request PDF", () => {
  it("prints the saved WITA date, original NPP and selected officer in the PDF", async () => {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({ data: await calibrationRequestPdf(request), useSystemFonts: true });
    const pdf = await task.promise;
    try {
      const page = await pdf.getPage(1);
      const content = await page.getTextContent();
      const text = content.items.flatMap((item) => "str" in item ? [item.str] : []).join(" ");
      expect(text).toContain("31 / 10 / 2026");
      expect(text).toContain("04125");
      expect(text).toContain(request.supervisor_name);
    } finally { await task.destroy(); }
  }, 20000);
  it("fills the provided one-page template and preserves the form identity", async () => {
    const bytes = await calibrationRequestPdf(request);
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toContain(request.request_number);
    expect(pdf.getAuthor()).toBe("PT SUCOFINDO Cabang Denpasar");
    await mkdir(".tools/pdf-preview-qa", { recursive: true });
    await writeFile(".tools/pdf-preview-qa/filled-request.pdf", bytes);
  });
  it("preserves long values in appendix pages instead of clipping them", async () => {
    const bytes = await calibrationRequestPdf({ ...request, notes: "[CONTOH] Catatan lengkap µm Ω ± " + "isian panjang ".repeat(270), laboratory: "X".repeat(200), estimated_cost: null });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    await mkdir(".tools/pdf-preview-qa", { recursive: true });
    await writeFile(".tools/pdf-preview-qa/long-request.pdf", bytes);
  });
  it("uses a safe PDF filename even for quotes, line breaks and path characters", () => {
    const name = calibrationRequestFilename({ request_number: 'x/../"\r\nHeader: injected' });
    expect(name).toMatch(/^FOR-SCI-UMA-197-[A-Za-z0-9_-]+\.pdf$/);
    expect(name.length).toBeLessThan(100);
  });
});
