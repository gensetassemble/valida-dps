import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/features/notifications/actions", () => ({
  readNotifications: vi.fn(),
}));
import { NotificationCard } from "@/features/notifications/inbox";
import type { Notification } from "@/features/notifications/model";
const notice = (overrides: Partial<Notification> = {}): Notification => ({
  id: "one",
  category: "personnel",
  title: "Proses perpanjangan",
  event_status: "processing",
  context_name: "[CONTOH] Person",
  entity_title: "[CONTOH] License",
  reference_number: "OLD/1",
  replacement_certificate_number: null,
  portfolio_code: null,
  expires_on: null,
  event_notes: null,
  target_href: "/kompetensi-personil/one",
  activity_group_id: "personnel:one",
  process_reset: false,
  read_at: null,
  created_at: "2026-11-01T16:00:00Z",
  ...overrides,
});
const html = (events: Notification[]) =>
  renderToStaticMarkup(
    createElement(NotificationCard, {
      events,
      saving: false,
      mark: async () => {},
    }),
  );
describe("notification card presentation", () => {
  it("shows the shared current status on the card while keeping original event labels in history", () => {
    const output = html([
      notice({
        category: "calibrations",
        entity_title: "[CONTOH] Caliper",
        event_status: "submitted",
        current_status: "cancelled",
        title: "Permintaan alat: Sedang Diajukan",
      }),
    ]);
    expect(output).toContain("Dibatalkan");
    // Historical delivery text is preserved rather than rewriting the original event.
    expect(output).toContain("Permintaan alat: Sedang Diajukan");
  });
  it("keeps long names/references and the new number accessible, with HTML escaped", () => {
    const reference = "QA/" + "1234567890".repeat(15),
      name = "[CONTOH] Long name ".repeat(15);
    const output = html([
      notice({
        context_name: name,
        entity_title: "<script>unsafe</script> " + "License ".repeat(30),
        reference_number: reference,
        replacement_certificate_number: "NEW/2",
        event_status: "renewed",
      }),
    ]);
    expect(output).toContain(reference);
    expect(output).toContain(name.trim());
    expect(output).toContain("NEW/2");
    expect(output).toContain("&lt;script&gt;");
    expect(output).not.toContain("<script>unsafe");
  });
  it("distinguishes read cards and keeps older unread events actionable within a cluster", () => {
    expect(html([notice({ read_at: "2026-11-02T00:00:00Z" })])).toContain(
      "Sudah dibaca",
    );
    const output = html([
      notice({ read_at: "2026-11-02T00:00:00Z" }),
      notice({
        id: "two",
        title: "Previous event",
        event_status: "unprocessed",
      }),
    ]);
    expect(output).toContain("Belum dibaca");
    expect(output).toContain("Lihat 2 aktivitas di halaman ini");
    expect(output).toContain("Previous event");
    expect(output).toContain("Tandai aktivitas ini dibaca");
  });
  it("shows a graceful unavailable state rather than an unsafe destination", () => {
    const output = html([notice({ target_href: "javascript:alert(1)" })]);
    expect(output).toContain("Detail tidak tersedia");
    expect(output).not.toContain("javascript:");
  });
});
