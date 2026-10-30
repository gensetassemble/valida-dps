import { describe, it, expect } from "vitest";
import { isSameOrigin } from "@/lib/http/same-origin";
describe("browser mutation origin", () => {
  it("accepts same authority when Next normalizes its internal loopback URL", () => {
    expect(
      isSameOrigin(
        new Request("http://localhost:3001/upload", {
          headers: {
            origin: "http://127.0.0.1:3001",
            host: "127.0.0.1:3001",
            "sec-fetch-site": "same-origin",
          },
        }),
      ),
    ).toBe(true);
  });
  it("rejects different sites and malformed origins even when cookies exist", () => {
    expect(
      isSameOrigin(
        new Request("https://valida.example/upload", {
          headers: {
            origin: "https://attacker.invalid",
            host: "valida.example",
          },
        }),
      ),
    ).toBe(false);
    expect(
      isSameOrigin(
        new Request("https://valida.example/upload", {
          headers: {
            origin: "https://valida.example",
            "sec-fetch-site": "cross-site",
          },
        }),
      ),
    ).toBe(false);
    expect(
      isSameOrigin(
        new Request("https://valida.example/upload", {
          headers: { origin: "null" },
        }),
      ),
    ).toBe(false);
  });
  it("requires Origin for uploads while allowing a non-browser logout without Origin", () => {
    const r = new Request("https://valida.example/upload");
    expect(isSameOrigin(r)).toBe(false);
    expect(isSameOrigin(r, true)).toBe(true);
  });
});
