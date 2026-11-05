import { describe, it, expect } from "vitest";
import { normalizeEquipmentUnit } from "@/features/operations/equipment-units";
import { monitoringValue } from "@/features/operations/monitoring";
import { operationalOrder } from "@/features/operations/list-order";

describe("Equipment owner subunits", () => {
  it("consolidates known spelling variants without merging UP and TBBM Lombok", () => {
    expect(normalizeEquipmentUnit("  DENPASAR ")).toBe("Denpasar");
    expect(normalizeEquipmentUnit("Denpasar - Celukan bawang")).toBe("Celukan Bawang");
    expect(normalizeEquipmentUnit("Denpasar -- Giliimanuk")).toBe("Gilimanuk");
    expect(normalizeEquipmentUnit("Lombok")).toBe("UP Lombok");
    expect(normalizeEquipmentUnit("Denpasar -- TBBM Lombok")).toBe("TBBM Lombok");
    expect(normalizeEquipmentUnit("Site Baru")).toBe("Site Baru");
    expect(normalizeEquipmentUnit("N/A")).toBe("N/A");
  });
  it("uses canonical labels in monitoring exports and orders before pagination", () => {
    const row = {unit: "DENPASAR", owner_unit: "Denpasar"};
    expect(monitoringValue(row, "unit")).toBe("Denpasar");
    expect(row.unit).toBe("DENPASAR");
    expect(operationalOrder("kalibrasi-alat", "unit", "desc")![0]).toEqual({column:"owner_unit",ascending:false});
    expect(operationalOrder("kompetensi-personil", "unit")).toBeNull();
  });
});
