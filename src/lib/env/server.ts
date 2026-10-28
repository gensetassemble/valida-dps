import "server-only";
import { z } from "zod";
const schema = z.object({
  APP_URL: z.url().default("http://localhost:3000"),
  APP_TIMEZONE: z.literal("Asia/Makassar").default("Asia/Makassar"),
});
export function getAppConfig() {
  const result = schema.safeParse({
    APP_URL: process.env.APP_URL,
    APP_TIMEZONE: process.env.APP_TIMEZONE,
  });
  if (!result.success)
    throw new Error("Konfigurasi APP_URL atau APP_TIMEZONE tidak valid.");
  const url = new URL(result.data.APP_URL);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("APP_URL harus HTTPS kecuali localhost.");
  return result.data;
}
