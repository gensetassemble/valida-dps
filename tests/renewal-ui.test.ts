import { describe, expect, it } from "vitest";
import {
  allowedRenewalTargets,
  outlookCompose,
} from "../src/lib/domain/renewal";
import { deadlineTone } from "../src/lib/domain/validity";

describe("renewal interaction contracts", () => {
  it("allows only the next business gate or a reasoned exception", () => {
    expect(allowedRenewalTargets("uncontacted")).toEqual([
      "contacted",
      "deferred",
      "not_renewed",
    ]);
    expect(allowedRenewalTargets("contacted")).not.toContain("po_received");
    expect(allowedRenewalTargets("offered")).toContain("po_received");
    expect(allowedRenewalTargets("deferred")).toEqual([
      "contacted",
      "not_renewed",
    ]);
    expect(allowedRenewalTargets("po_received")).toEqual([]);
    expect(allowedRenewalTargets("not_renewed")).toEqual([]);
  });
  it("encodes PIC, subject punctuation and multiline message without injecting compose parameters", () => {
    const url = new URL(
      outlookCompose(
        "pic+qa@example.invalid",
        "Penawaran A & B? #1",
        "Yth. PIC,\nObjek A&B\nTerima kasih",
      ),
    );
    expect(url.origin).toBe("https://outlook.office.com");
    expect(url.searchParams.get("to")).toBe("pic+qa@example.invalid");
    expect(url.searchParams.get("subject")).toBe("Penawaran A & B? #1");
    expect(url.searchParams.get("body")).toBe(
      "Yth. PIC,\nObjek A&B\nTerima kasih",
    );
    expect([...url.searchParams.keys()]).toEqual(["to", "subject", "body"]);
  });
  it("uses expiry boundaries, including today and the 90-day window", () => {
    const today = "2026-10-29";
    expect(deadlineTone("2026-10-28", today)).toBe("expired");
    expect(deadlineTone(today, today)).toBe("soon");
    expect(deadlineTone("2027-01-27", today)).toBe("soon");
    expect(deadlineTone("2027-01-28", today)).toBe("normal");
    expect(deadlineTone("", today)).toBe("unknown");
  });
});
