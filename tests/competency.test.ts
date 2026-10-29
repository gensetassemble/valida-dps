import { it, expect } from "vitest";
import { evaluateRequirements } from "@/lib/domain/competency";
import { validityLabel } from "@/lib/domain/validity";
const requirement = {
  certificate_type_id: "test-type",
  verification_status: "verified",
};
it("does not claim an unverified mapping is a legal requirement", () => {
  expect(
    evaluateRequirements(
      [{ ...requirement, verification_status: "pending" }],
      [],
    ).status,
  ).toBe("Persyaratan Belum Diverifikasi");
  expect(evaluateRequirements([], []).allowed).toBe(false);
});
it("blocks expired verified mandatory competency and pending evidence", () => {
  const cert = {
    ...requirement,
    expiry_date: "2026-10-28",
    validity_kind: "term",
  };
  expect(
    evaluateRequirements([requirement], [cert], "2026-10-29").allowed,
  ).toBe(false);
  expect(
    evaluateRequirements(
      [requirement],
      [{ ...cert, expiry_date: "2030-01-01", verification_status: "pending" }],
      "2026-10-29",
    ).allowed,
  ).toBe(false);
});
it("requires every verified mapping while accepting a verified lifetime per record", () => {
  const cert = { ...requirement, expiry_date: null, validity_kind: "lifetime" };
  expect(
    evaluateRequirements([requirement], [cert], "2026-10-29").allowed,
  ).toBe(true);
  expect(
    evaluateRequirements(
      [requirement, { ...requirement, certificate_type_id: "another-type" }],
      [cert],
      "2026-10-29",
    ).allowed,
  ).toBe(false);
});
it("labels an unverified lifetime record distinctly without safe clearance", () =>
  expect(validityLabel(null, false, true)).toBe(
    "Tanpa Kedaluwarsa (perlu verifikasi dokumen)",
  ));
