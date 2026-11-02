import { describe, it, expect } from "vitest";
import {
  filterPriorities,
  type ExpiringItem,
} from "@/features/operations/expiring-priorities";
const rows: ExpiringItem[] = [
  {
    domain: "calibrations",
    id: "1",
    entity_name: "Gelas ukur",
    title: "DPS-001",
    reference_number: "CAL-2026-01",
    certificate_kind: "Sertifikat Kalibrasi",
    portfolio_code: "HMPM",
    location: "Denpasar",
    responsible_name: "Koordinator A",
    expiry_date: "2026-11-03",
    validity_status: "Kritis",
    is_example: false,
  },
  {
    domain: "personnel",
    id: "2",
    entity_name: "Personil B",
    title: "Lisensi",
    reference_number: "LIC-99",
    certificate_kind: "Draught Survey",
    expiry_date: "2026-11-05",
    validity_status: "Kritis",
    is_example: false,
  },
];
describe("Dashboard priority subset", () => {
  it("searches actual certificate numbers and owners across the supplied shortlist", () => {
    expect(
      filterPriorities(rows, "cal-2026 koordinator", "", "").map((r) => r.id),
    ).toEqual(["1"]);
    expect(filterPriorities(rows, "draught", "", "").map((r) => r.id)).toEqual([
      "2",
    ]);
  });
  it("combines category/portfolio filters and reset returns only the supplied accessible records", () => {
    expect(filterPriorities(rows, "", "calibrations", "HMPM")).toHaveLength(1);
    expect(filterPriorities(rows, "", "personnel", "HMPM")).toHaveLength(0);
    expect(filterPriorities(rows, "", "", "")).toEqual(rows);
    expect(filterPriorities(rows, "not loaded", "", "")).toHaveLength(0);
  });
});
