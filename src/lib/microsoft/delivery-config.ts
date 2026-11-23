import "server-only";
import { z } from "zod";
import { isProductionEnvironment } from "@/lib/env/runtime";

export const MAIL_TEST_RECIPIENT = "kadek.nicko@sucofindo.co.id";
const configSchema = z.object({
  tenantId: z.uuid(), clientId: z.uuid(), clientSecret: z.string().min(1),
  sender: z.email().refine(v => v.toLowerCase().endsWith("@sucofindo.co.id")),
  mode: z.enum(["test", "live"]),
});
export function getMailDeliveryConfig() {
  if (process.env.ENABLE_OUTLOOK_EMAIL !== "true") return null;
  const result = configSchema.safeParse({ tenantId: process.env.MICROSOFT_TENANT_ID,
    clientId: process.env.MICROSOFT_CLIENT_ID, clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    sender: process.env.OUTLOOK_NOTIFICATION_MAILBOX, mode: process.env.VALIDA_MAIL_MODE });
  if (!result.success || (result.data.mode === "live" && !isProductionEnvironment())) return null;
  return result.data;
}
export function mailDeliveryStatus() {
  const config = getMailDeliveryConfig();
  return { enabled: !!config, mode: config?.mode || "disabled",
    sender: config?.sender || null,
    reason: config ? config.mode === "test"
      ? `Mode uji: seluruh email diarahkan ke ${MAIL_TEST_RECIPIENT}; maksimal tiga email per proses otomatis.`
      : "Konfigurasi mailbox organisasi tersedia. Pastikan izin telah dibuktikan melalui email uji sebelum mengirim kepada pelanggan."
      : "Pengiriman belum tersedia. Mailbox organisasi, izin Microsoft 365, dan konfigurasi pengiriman perlu dilengkapi. Draf Outlook tetap tersedia." };
}
