import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { assertDatabaseEnvironment, isProductionEnvironment } from "@/lib/env/runtime";
afterEach(() => vi.unstubAllEnvs());
describe("development and production database boundary", () => {
  it("blocks the live database by default outside production", () => {
    vi.stubEnv("VERCEL_ENV", ""); vi.stubEnv("APP_ENVIRONMENT", "development");
    expect(() => assertDatabaseEnvironment("https://vzxmnkmvcbzxrkzdtxuy.supabase.co")).toThrow();
    expect(() => assertDatabaseEnvironment("https://development.example.invalid")).not.toThrow();
  });
  it("allows only the operational project for production deployments", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isProductionEnvironment()).toBe(true);
    expect(() => assertDatabaseEnvironment("https://development.example.invalid")).toThrow();
    expect(() => assertDatabaseEnvironment("https://vzxmnkmvcbzxrkzdtxuy.supabase.co")).not.toThrow();
  });
  it("does not let a copied application flag override a Vercel preview", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("APP_ENVIRONMENT", "production");
    expect(isProductionEnvironment()).toBe(false);
    expect(() => assertDatabaseEnvironment("https://vzxmnkmvcbzxrkzdtxuy.supabase.co")).toThrow();
  });
});
