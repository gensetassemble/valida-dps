import { describe, expect, it } from "vitest";
import { OPERATIONAL_ENTITIES } from "@/features/operations/entities";
import { recordSchema } from "@/features/master-data/validation";

const entity = OPERATIONAL_ENTITIES["kompetensi-personil"];
const values = {
  ...Object.fromEntries(entity.fields.map(f => [f.key, f.kind === "boolean" ? true : null])),
  employee_id: "ac910000-0000-4000-8000-000000000002",
  certificate_type_id: "ac910000-0000-4000-8000-000000000004",
  portfolio_id: "ac910000-0000-4000-8000-000000000003",
  original_title: "Petugas Verifikasi Teknis Batubara", validity_kind: "term",
};
describe("license responsibility selection", () => {
  it("requires a responsible portfolio on new certificates", () => {
    expect(recordSchema(entity).safeParse(values).success).toBe(true);
    const missing = recordSchema(entity).safeParse({ ...values, portfolio_id: null });
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error.issues.some(i => i.path[0] === "portfolio_id")).toBe(true);
  });
  it("allows responsibility corrections without moving the employee identity", () => {
    const parsed = recordSchema(entity, true).parse(Object.fromEntries(Object.entries(values).filter(([key]) => key !== "employee_id")));
    expect(parsed.portfolio_id).toBe(values.portfolio_id);
    expect(parsed.employee_id).toBeUndefined();
  });
});
