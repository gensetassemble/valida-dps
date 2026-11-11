import { describe, expect, it } from "vitest";
import { calibrationExpiryReview } from "@/features/operations/calibration-expiry";
import { recordSchema } from "@/features/master-data/validation";
import { OPERATIONAL_ENTITIES } from "@/features/operations/entities";

describe("one monitoring expiry with documented corrections", () => {
  const dates = { issue_date: "2025-12-10", interval_months: 12, due_date: "2026-12-20" };
  it("flags historical differences without replacing the stored expiry", () => {
    expect(calibrationExpiryReview(dates)).toEqual({calculated:"2026-12-10", differs:true, needsReview:true});
    expect(dates.due_date).toBe("2026-12-20");
    expect(calibrationExpiryReview({...dates,due_date:"2026-12-10"}).needsReview).toBe(false);
  });
  it("accepts a reviewed correction only for its documented target date", () => {
    const reviewed = {...dates,reported_due_date:"2026-12-20",resolution_note:"Sesuai tanggal pada sertifikat asli."};
    expect(calibrationExpiryReview(reviewed).needsReview).toBe(false);
    expect(calibrationExpiryReview({...reviewed,due_date:"2026-12-21"}).needsReview).toBe(true);
    expect(calibrationExpiryReview({issue_date:null,interval_months:null,due_date:null}).needsReview).toBe(false);
  });
  it("validates a correction reason on the server", () => {
    const entity = OPERATIONAL_ENTITIES["riwayat-kalibrasi"];
    const payload = Object.fromEntries(entity.fields.map(f=>[f.key,f.kind === "boolean" ? true : f.kind === "select" ? f.options?.[0]?.value || "" : ""]));
    Object.assign(payload, dates, {equipment_id:"40000000-0000-4000-8000-000000000001", calculation_base:"issue_date",result:"layak",
      calibration_internal:"√",calibration_external:"-",significant_yes:"√",significant_no:"-"});
    expect(recordSchema(entity).safeParse(payload).success).toBe(false);
    expect(recordSchema(entity).safeParse({...payload,resolution_note:"Sesuai sertifikat resmi."}).success).toBe(true);
    expect(recordSchema(entity).safeParse({...payload,due_date:"2026-12-10"}).success).toBe(true);
  });
});
