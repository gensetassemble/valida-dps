import "server-only";
import { getMicrosoftConfig } from "./config";
import type { EmailProvider, MailResult } from "./types";
const disabled = (): MailResult => ({ ok: false, state: "Gagal", code: "INTEGRATION_DISABLED", message: "Pengiriman email dinonaktifkan pada tahap persiapan infrastruktur." });
export const microsoftMail: EmailProvider = {
  async connectMailbox() { return { ok: false, message: "Menunggu persetujuan administrator, pengikatan akun, serta penyimpanan token terenkripsi." }; },
  getConnectionStatus() {
    return getMicrosoftConfig()
      ? { state: "Menunggu Otorisasi", message: "Konfigurasi tersedia; izin dan koneksi belum diverifikasi. Pengiriman dinonaktifkan." }
      : { state: "Belum Dikonfigurasi", message: "Microsoft 365 telah dipilih. Persetujuan Entra dan mailbox resmi masih diperlukan." };
  },
  async sendNotificationEmail() { return disabled(); },
  async sendCommercialEmail() { return disabled(); },
};
export const connectMailbox = microsoftMail.connectMailbox;
export const getConnectionStatus = microsoftMail.getConnectionStatus;
export const sendNotificationEmail = microsoftMail.sendNotificationEmail;
export const sendCommercialEmail = microsoftMail.sendCommercialEmail;
