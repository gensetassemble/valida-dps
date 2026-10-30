import { describe, it, expect } from "vitest";
import {
  requestTransitions,
  renewalTransitions,
} from "@/features/workflows/model";
import { calibrationRequestHtml } from "@/features/workflows/print-form";
import { operationalValidity } from "@/lib/domain/validity";
import {
  businessNotes,
  preserveImportNotes,
} from "@/features/operations/notes";
describe("operational workflows", () => {
  it("removes import diagnostics while keeping business follow-up notes", () => {
    expect(
      businessNotes(
        "Kandidat aset: identitas dan kepemilikan belum diverifikasi. | BTB LAB GEB baris 9 | Kondisi sumber: Baik | Status sumber: Terpakai | Tag berulang; identitas kandidat perlu ditinjau.",
      ),
    ).toBe("");
    expect(
      businessNotes(
        "Dalam Proses Perpanjangan | VALIDA Kompetensi Personil Final.xlsx, Sheet1 baris 49 | Raw CSV dan koreksi NPP terdahulu tetap di staging.",
      ),
    ).toBe("Dalam Proses Perpanjangan");
    expect(
      businessNotes("Menunggu jadwal laboratorium | Hubungi PIC Senin"),
    ).toBe("Menunggu jadwal laboratorium | Hubungi PIC Senin");
    const original =
      "Menunggu jadwal | Kandidat aset: data sumber | BTB LAB GEB baris 9";
    const stored = preserveImportNotes(original, "Kalibrasi dijadwalkan");
    expect(businessNotes(stored)).toBe("Kalibrasi dijadwalkan");
    expect(stored).toContain("BTB LAB GEB baris 9");
  });
  it("separates requester and PTK actions and makes closed processes terminal", () => {
    expect(requestTransitions("submitted", true, false)).toEqual([]);
    expect(requestTransitions("submitted", false, true)).toEqual([
      "accepted",
      "correction",
    ]);
    expect(requestTransitions("completed", true, true)).toEqual([]);
    expect(renewalTransitions("unprocessed")).not.toContain("renewed");
    expect(renewalTransitions("renewed")).toEqual([]);
  });
  it("does not derive validity from renewal progress", () => {
    for (const status of ["unprocessed", "processing", "renewed"]) {
      expect(status).toBeTruthy();
      expect(operationalValidity("2025-01-01", false, "2026-10-30")).toBe(
        "Expired",
      );
    }
  });
  it("escapes user-entered printable fields and leaves missing estimates unfilled", () => {
    const html = calibrationRequestHtml({
      id: "test",
      request_number: '<script>alert("x")</script>',
      equipment_snapshot: { name: "<img src=x onerror=alert(1)>" },
      notes: "[CONTOH] Calibration",
    });
    expect(html).not.toContain("<script>alert(");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("FOR/SCI-UMA/197");
    expect(html).toContain("WAKTU &amp; BIAYA");
    expect(html).toContain("Mengetahui,");
    expect(html).not.toContain("Rp. 0");
  });
});
