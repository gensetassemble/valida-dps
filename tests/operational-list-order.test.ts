import { describe, expect, it } from "vitest";
import { operationalOrder } from "@/features/operations/list-order";

describe("Operational list ordering", () => {
  it("keeps priority ascending even with a stale descending URL and uses date as a tie breaker", () => {
    for (const entity of ["kalibrasi-alat", "kompetensi-personil"]) {
      const order = operationalOrder(entity, undefined, "desc")!;
      expect(order[0]).toEqual({ column: "validity_priority", ascending: true });
      expect(order[1]).toEqual({column: entity === "kalibrasi-alat" ? "latest_due_date" : "expiry_date", ascending: true});
    }
  });
  it("sorts portfolio codes rather than UUID arrays and supports employee or license alphabetical order", () => {
    expect(operationalOrder("kompetensi-personil", "portfolio")![0].column).toBe("portfolio_sort_key");
    expect(operationalOrder("kalibrasi-alat", "portfolio")![0].column).toBe("portfolio_code");
    expect(operationalOrder("kompetensi-personil", "employee")![0].column).toBe("employee_name");
    expect(operationalOrder("kompetensi-personil", "alphabet")![0].column).toBe("original_title");
  });
  it("leaves explicit column sorting and unrelated lists to the registry whitelist", () => {
    expect(operationalOrder("kompetensi-personil", "certificate_number")).toBeNull();
    expect(operationalOrder("sertifikat-klien")).toBeNull();
    expect(operationalOrder("kalibrasi-alat", "injected(column)")).toBeNull();
  });
});
