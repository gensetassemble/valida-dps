import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/env/public";

export async function signOutCurrentDevice() {
  const config = getSupabaseConfig();
  try {
    if (config) {
      const db = await createClient();
      await db.auth.signOut({ scope: "local" });
    }
  } catch {
    // Local logout must still complete if Auth cannot revoke the remote refresh token.
  } finally {
    if (config) {
      const store = await cookies();
      const base = `sb-${new URL(config.url).hostname.split(".")[0]}-auth-token`;
      for (const { name } of store.getAll()) {
        if (
          name === base ||
          name === base + "-code-verifier" ||
          name.startsWith(base + ".") ||
          name.startsWith(base + "-code-verifier.")
        ) {
          store.set(name, "", {
            path: "/",
            maxAge: 0,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
          });
        }
      }
    }
  }
}
