import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildEquipmentImportPreview } from "@/features/equipment-sync/review";

describe("equipment import screening", () => {
  it("shows certificate and date changes against the current event", () => {
    const rows = [
      {
        sheet: "LAB",
        row: 9,
        portfolio: "LAB",
        name: "Rotameter Impinger",
        tag: "LAB-001",
        serial: "S-1",
        asset: {},
        calibration: {
          component_label: "Katup A",
          certificate_number: "CERT-NEW",
          issue_date: "2026-11-01",
          due_date: "2027-11-01",
        },
        raw: {},
      },
    ];
    const result = buildEquipmentImportPreview(
      rows,
      [
        {
          sheet: "LAB",
          row: 9,
          name: "Rotameter Impinger",
          tag: "LAB-001",
          equipment_id: "equipment-1",
          equipment: "unchanged",
          calibration: "added",
        },
      ],
      [
        {
          equipment_id: "equipment-1",
          component_label: "Katup A",
          certificate_number: "CERT-OLD",
          issue_date: "2025-11-01",
          due_date: "2026-11-01",
        },
      ],
    );
    expect(result[0].requiresReview).toBe(true);
    expect(result[0].changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "certificate_number",
          before: "CERT-OLD",
          after: "CERT-NEW",
        }),
        expect.objectContaining({
          field: "issue_date",
          before: "2025-11-01",
          after: "2026-11-01",
        }),
      ]),
    );
  });

  it("does not request a classification when sensitive values are unchanged", () => {
    const row = {
      sheet: "CSV",
      row: 2,
      portfolio: "PIK",
      name: "Pump",
      tag: "P-1",
      asset: { notes: "Updated" },
      calibration: { certificate_number: "CERT-1", due_date: "2027-01-01" },
      raw: {},
    };
    const [result] = buildEquipmentImportPreview(
      [row],
      [{ sheet: "CSV", row: 2, name: "Pump", tag: "P-1", equipment_id: "e-1", equipment: "updated", calibration: "updated" }],
      [{ equipment_id: "e-1", certificate_number: "CERT-1", due_date: "2027-01-01" }],
    );
    expect(result.requiresReview).toBe(false);
    expect(result.changes).toEqual([]);
  });
});
