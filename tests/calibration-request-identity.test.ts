import { describe, expect, it } from "vitest";
import {
  draftBusinessDate,
  draftSignatureDate,
} from "@/features/workflows/request-form-model";
import { calibrationRequestHtml } from "@/features/workflows/print-form";

describe("UMA saved draft identity", () => {
  it("uses the draft creation date in WITA across the UTC day boundary", () => {
    expect(draftBusinessDate("2026-10-30T18:00:00Z")).toBe("2026-10-31");
    expect(draftSignatureDate("2026-10-30T18:00:00Z")).toBe("31 / 10 / 2026");
    expect(draftBusinessDate("2026-01-01T01:00:00+08:00")).toBe("2026-01-01");
  });
  it("does not fabricate a date or NPP", () => {
    expect(draftBusinessDate(null)).toBeNull();
    expect(draftSignatureDate("invalid")).toBeNull();
    expect(calibrationRequestHtml({})).toContain("NPP. Non-NPP");
  });
  it("prints the original NPP text, selected officer and saved date safely", () => {
    const html = calibrationRequestHtml({
      requester_npp: "04125",
      supervisor_name: "Kepala <UP>",
      created_at: "2026-10-30T18:00:00Z",
    });
    expect(html).toContain("NPP. 04125");
    expect(html).toContain("Kepala &lt;UP&gt;");
    expect(html).toContain("31 / 10 / 2026");
  });
});
