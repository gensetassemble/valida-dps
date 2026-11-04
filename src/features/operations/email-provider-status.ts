import "server-only";
import { getConnectionStatus } from "@/lib/microsoft/mail-service";
export function renewalEmailProviderStatus() {
  return {
    provider:"Microsoft Graph",
    enabled:false as const,
    state:getConnectionStatus().state,
    reason:"Pengiriman belum tersedia. Pratinjau dan salin email dapat digunakan. Administrator perlu menghubungkan mailbox resmi Microsoft 365 terlebih dahulu.",
  };
}
