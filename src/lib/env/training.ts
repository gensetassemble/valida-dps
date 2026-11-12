import "server-only";
export const TRAINING_PROJECT_REF = "qjxwohmaqxdemlkkwdus";
export function isTrainingEnvironment() {
  if (process.env.VALIDA_TRAINING_MODE !== "true") return false;
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://unconfigured.invalid").hostname;
  if (process.env.VERCEL_ENV === "production" || process.env.APP_ENVIRONMENT === "production" || host !== `${TRAINING_PROJECT_REF}.supabase.co`)
    throw new Error("Sandbox harus memakai database latihan dan deployment nonproduksi.");
  return true;
}
