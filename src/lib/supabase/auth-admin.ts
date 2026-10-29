import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/env/public";

export function getAuthAdminClient() {
  const config = getSupabaseConfig();
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !key) return null;
  let serviceRole = false;
  if (key.startsWith("eyJ")) {
    try {
      serviceRole =
        JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
          .role === "service_role";
    } catch {
      /* Invalid server credential. */
    }
  }
  if (!key.startsWith("sb_secret_") && !serviceRole) return null;
  return createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
