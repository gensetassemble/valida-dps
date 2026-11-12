import "server-only";
import { isTrainingEnvironment } from "./training";
// This project retains the operational data already served by the live domain.
export const PRODUCTION_PROJECT_REF = "vzxmnkmvcbzxrkzdtxuy";
export function isProductionEnvironment() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "production";
  return process.env.APP_ENVIRONMENT === "production";
}
export function assertDatabaseEnvironment(url: string) {
  isTrainingEnvironment();
  const host = new URL(url).hostname;
  const live = host === `${PRODUCTION_PROJECT_REF}.supabase.co`;
  if (live !== isProductionEnvironment())
    throw Error("Target database tidak sesuai dengan lingkungan aplikasi.");
}
