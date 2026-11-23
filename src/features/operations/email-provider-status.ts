import "server-only";
import { mailDeliveryStatus } from "@/lib/microsoft/delivery-config";
export function renewalEmailProviderStatus() {
  const status = mailDeliveryStatus();
  return {
    provider:"Microsoft Graph",
    ...status,
    commercialEnabled: status.mode === "live" && process.env.ENABLE_OUTLOOK_COMMERCIAL === "true",
    state:status.enabled ? "Dikonfigurasi" : "Belum Dikonfigurasi",
  };
}
