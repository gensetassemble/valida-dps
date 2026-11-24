import { describe, expect, it } from "vitest";
import { OPERATIONAL_ENTITIES } from "@/features/operations/entities";
import { recordSchema } from "@/features/master-data/validation";

const entity = OPERATIONAL_ENTITIES["kompetensi-personil"];
const values = {
  ...Object.fromEntries(entity.fields.map(f => [f.key, f.kind === "boolean" ? true : null])),
  employee_id: "ac910000-0000-4000-8000-000000000002",
  certificate_type_id: "ac910000-0000-4000-8000-000000000004",
  original_title: "Petugas Verifikasi Teknis Batubara", validity_kind: "term",
};
describe("personnel certificate form", () => {
  it("does not expose a certificate responsibility portfolio", () => {
    expect(entity.fields.some(field => field.key === "portfolio_id")).toBe(false);
    expect(entity.columns).not.toContain("portfolio_id");
    expect(recordSchema(entity).safeParse(values).success).toBe(true);
  });
  it("edits certificate data without moving the employee identity", () => {
    const parsed = recordSchema(entity, true).parse(Object.fromEntries(Object.entries(values).filter(([key]) => key !== "employee_id")));
    expect(parsed).not.toHaveProperty("portfolio_id");
    expect(parsed.employee_id).toBeUndefined();
  });
});
