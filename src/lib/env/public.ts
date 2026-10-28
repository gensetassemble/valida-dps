import { z } from "zod";
const schema = z.object({ url: z.url(), key: z.string().startsWith("sb_publishable_") });
export function getSupabaseConfig() {
  const result = schema.safeParse({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY });
  if (!result.success) return null;
  const url = new URL(result.data.url);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
  return result.data;
}
