import "server-only";
import { z } from "zod";
const schema = z.object({
  tenantId: z.uuid(),
  clientId: z.uuid(),
  clientSecret: z.string().min(1),
  redirectUri: z.url(),
});
export function getMicrosoftConfig() {
  const parsed = schema.safeParse({
    tenantId: process.env.MICROSOFT_TENANT_ID,
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI,
  });
  if (!parsed.success) return null;
  const url = new URL(parsed.data.redirectUri);
  if (
    url.pathname !== "/api/microsoft/callback" ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && url.hostname === "localhost"))
  )
    return null;
  return parsed.data;
}
