import { describe, expect, it } from "vitest";
import { isPasswordManagedAccount } from "@/lib/auth/password-policy";

describe("managed password policy", () => {
  it("matches the shared tester account without case or whitespace sensitivity", () => {
    expect(isPasswordManagedAccount(" Tester@Tester.com ")).toBe(true);
  });

  it("does not block other tester or regular accounts", () => {
    expect(isPasswordManagedAccount("tester.personal@example.com")).toBe(false);
    expect(isPasswordManagedAccount("reader@example.com")).toBe(false);
    expect(isPasswordManagedAccount(null)).toBe(false);
  });
});
