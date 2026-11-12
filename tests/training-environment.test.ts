import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
import { isTrainingEnvironment } from "@/lib/env/training";
import { assertDatabaseEnvironment } from "@/lib/env/runtime";
import { getMicrosoftConfig } from "@/lib/microsoft/config";
afterEach(()=>vi.unstubAllEnvs());
describe("Isolated training environment",()=>{
  it("does not enable training for normal production",()=>{
    vi.stubEnv("VALIDA_TRAINING_MODE","");vi.stubEnv("VERCEL_ENV","production");
    expect(isTrainingEnvironment()).toBe(false);
  });
  it("rejects training on the live project or a production deployment",()=>{
    vi.stubEnv("VALIDA_TRAINING_MODE","true");vi.stubEnv("APP_ENVIRONMENT","");
    vi.stubEnv("VERCEL_ENV","preview");vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://vzxmnkmvcbzxrkzdtxuy.supabase.co");
    expect(()=>isTrainingEnvironment()).toThrow();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://qjxwohmaqxdemlkkwdus.supabase.co");vi.stubEnv("VERCEL_ENV","production");
    expect(()=>isTrainingEnvironment()).toThrow();
  });
  it("allows only isolated preview training and never points it to live data",()=>{
    vi.stubEnv("VALIDA_TRAINING_MODE","true");vi.stubEnv("APP_ENVIRONMENT","");vi.stubEnv("VERCEL_ENV","preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://qjxwohmaqxdemlkkwdus.supabase.co");
    expect(isTrainingEnvironment()).toBe(true);
    expect(()=>assertDatabaseEnvironment("https://vzxmnkmvcbzxrkzdtxuy.supabase.co")).toThrow();
    expect(getMicrosoftConfig()).toBeNull();
  });
});
