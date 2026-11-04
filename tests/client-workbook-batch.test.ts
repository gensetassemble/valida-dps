import { describe, expect, it } from "vitest";
import { approvedClientWorkbook } from "../src/features/imports/client-workbook-batch";
describe("operational workbook authorization boundary", () => {
  const batch = { id: "50b0a76a-bb9b-5e1a-ad78-039d6a750d5e", branch_code: "DPS", domain: "clients", source_count: 19, file_hash: "cad16977f7e8c3fdf6b8ff56142ef2d90440b9609e3714de20947e516c574770" };
  it("accepts only the explicitly authorized source", () => {
    expect(approvedClientWorkbook(batch)).toBe(true);
    for (const key of Object.keys(batch)) expect(approvedClientWorkbook({ ...batch, [key]: "other" })).toBe(false);
    expect(approvedClientWorkbook({})).toBe(false);
  });
});
