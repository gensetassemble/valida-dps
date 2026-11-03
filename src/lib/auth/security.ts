import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function hasSecondFactor(db: SupabaseClient) {
  const { data, error } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  return !error && data?.currentLevel === "aal2";
}

export async function hasRecoverySession(db: SupabaseClient) {
  const { data: user, error } = await db.auth.getUser();
  if (error || !user.user) return false;
  // Auth-managed session + AMR, never the URL, local storage or a client flag.
  const result = await db.rpc("password_recovery_session");
  return !result.error && result.data === true;
}
