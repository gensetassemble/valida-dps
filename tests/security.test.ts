import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getSupabaseConfig } from "@/lib/env/public";
import { getMicrosoftConfig } from "@/lib/microsoft/config";
import { microsoftMail } from "@/lib/microsoft/mail-service";
import { validateCertificate, uploadCertificate, getCertificateSignedUrl } from "@/lib/supabase/storage";
afterEach(() => vi.unstubAllEnvs());
describe("Public configuration boundary", () => {
  it("fails closed without configuration", () => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ""); expect(getSupabaseConfig()).toBeNull(); });
  it("rejects a secret key in public config", () => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_secret_FOR_TEST_ONLY"); expect(getSupabaseConfig()).toBeNull(); });
  it("rejects insecure remote HTTP", () => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_TEST_ONLY"); expect(getSupabaseConfig()).toBeNull(); });
  it("accepts a public project configuration", () => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_TEST_ONLY"); expect(getSupabaseConfig()?.url).toBe("https://example.supabase.co"); });
});
describe("Mail must never pretend to send", () => {
  it("does not treat flags as administrator approval", async () => {
    vi.stubEnv("ENABLE_OUTLOOK_EMAIL", "true"); vi.stubEnv("ENABLE_OUTLOOK_COMMERCIAL", "true");
    const message = { to: [], subject: "Test", text: "No delivery" };
    expect((await microsoftMail.sendNotificationEmail(message)).ok).toBe(false);
    expect((await microsoftMail.sendCommercialEmail(message, { userId: "test", confirmed: true })).ok).toBe(false);
    expect((await microsoftMail.connectMailbox("test")).ok).toBe(false);
    expect(microsoftMail.getConnectionStatus().state).not.toBe("Terhubung");
  });
  it("rejects incomplete Entra configuration", () => { vi.stubEnv("MICROSOFT_TENANT_ID", "common"); expect(getMicrosoftConfig()).toBeNull(); });
});
describe("Certificate access", () => {
  const pdf = { name: "test.pdf", type: "application/pdf", size: 20 };
  it("checks PDF magic bytes", () => { expect(() => validateCertificate(pdf, new TextEncoder().encode("<html>"))).toThrow(); expect(() => validateCertificate(pdf, new TextEncoder().encode("%PDF-1.7"))).not.toThrow(); });
  it("checks type, extension and size", () => { for (const file of [{ ...pdf, name: "test.exe" }, { ...pdf, type: "text/plain" }, { ...pdf, size: 20_000_000 }]) expect(() => validateCertificate(file, new TextEncoder().encode("%PDF-"))).toThrow(); });
  it("keeps upload and signed URLs closed", async () => { await expect(uploadCertificate()).rejects.toThrow(); await expect(getCertificateSignedUrl()).rejects.toThrow(); });
});
