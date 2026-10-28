"use client";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/env/public";
import type { Database } from "@/types/database";
export function createClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase belum dikonfigurasi dengan benar.");
  return createBrowserClient<Database>(config.url, config.key, { cookieOptions: { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" } });
}
