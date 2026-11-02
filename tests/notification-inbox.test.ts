import { describe, expect, it } from "vitest";
import {
  clusters,
  dateGroup,
  eventLabel,
  eventTone,
  safeTarget,
  shortTitle,
  type Notification,
} from "@/features/notifications/model";
const sample = (overrides: Partial<Notification> = {}): Notification => ({
  id: "one",
  category: "personnel",
  title: "Status perpanjangan sertifikat: Sedang Diproses",
  event_status: "processing",
  context_name: "[CONTOH] Person",
  entity_title: "[CONTOH] License",
  reference_number: "QA/1",
  replacement_certificate_number: null,
  portfolio_code: null,
  expires_on: "2020-01-01",
  event_notes: null,
  target_href: "/kompetensi-personil/one?branch=DPS",
  activity_group_id: "personnel:case1",
  process_reset: false,
  read_at: null,
  created_at: "2026-11-01T16:01:00Z",
  ...overrides,
});
describe("notification inbox", () => {
  it("uses calendar days in WITA, including midnight boundaries", () => {
    const now = new Date("2026-11-01T16:05:00Z");
    expect(dateGroup("2026-11-01T16:01:00Z", now)).toBe("Hari Ini");
    expect(dateGroup("2026-11-01T15:59:00Z", now)).toBe("Kemarin");
    expect(dateGroup("2026-10-28T16:00:00Z", now)).toBe("7 Hari Terakhir");
    expect(dateGroup("2026-10-20T16:00:00Z", now)).toBe("Lebih Lama");
  });
  it("groups only matching process IDs, categories and calendar sections, preserving every event", () => {
    const rows = [
      sample(),
      sample({ id: "two", event_status: "unprocessed" }),
      sample({ id: "other", activity_group_id: "personnel:case2" }),
      sample({ id: "old", created_at: "2026-10-01T00:00:00Z" }),
      sample({ id: "none", activity_group_id: null }),
    ];
    const result = clusters(rows, new Date("2026-11-01T17:00:00Z"));
    expect(result).toHaveLength(4);
    expect(result[0].events.map((e) => e.id)).toEqual(["one", "two"]);
    expect(result.flatMap((g) => g.events)).toHaveLength(rows.length);
  });
  it("keeps workflow progress separate from expired dates and keeps new numbers", () => {
    const n = sample({
      event_status: "renewed",
      replacement_certificate_number: "NEW/2",
    });
    expect(eventLabel(n)).toBe("Sudah Diperpanjang");
    expect(eventTone(n)).toBe("success");
    expect(shortTitle(n)).toBe("Sertifikat [CONTOH] License diperpanjang");
    expect(n.expires_on).toBe("2020-01-01");
    expect(n.replacement_certificate_number).toBe("NEW/2");
  });
  it("blocks external/script targets while allowing existing local detail routes", () => {
    for (const bad of [
      "https://example.com",
      "//example.com",
      "javascript:alert(1)",
      "/\\example.com",
      "/\nredirect",
    ])
      expect(safeTarget(bad)).toBeNull();
    expect(safeTarget(sample().target_href)).toBe(sample().target_href);
    expect(safeTarget(null)).toBeNull();
  });
});
