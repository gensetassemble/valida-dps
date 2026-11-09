import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeadlineRemaining } from "@/components/ui/deadline-remaining";

const render = (value: unknown, lifetime = false) =>
  renderToStaticMarkup(createElement(DeadlineRemaining, {value, lifetime}));

describe("Personnel deadline reminder", () => {
  afterEach(() => vi.useRealTimers());
  it("counts calendar days using WITA rather than the UTC day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T16:01:00Z"));
    expect(render("2026-11-08")).toContain("1 hari lewat");
    expect(render("2026-11-09")).toContain("Hari ini");
    expect(render("2026-11-10")).toContain("1 hari lagi");
  });
  it("omits countdowns for lifetime certificates and missing or invalid dates", () => {
    expect(render("2026-11-08", true)).toBe("");
    for (const value of [null, undefined, "", "tanggal tidak valid"])
      expect(render(value)).toBe("");
  });
});
