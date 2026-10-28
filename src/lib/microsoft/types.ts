export type ConnectionState =
  "Belum Dikonfigurasi" | "Menunggu Otorisasi" | "Terhubung";
export type EmailState =
  "Draf" | "Mengirim" | "Diterima Penyedia" | "Gagal" | "Terkirim ke Tujuan";
export type MailMessage = { to: string[]; subject: string; text: string };
export type MailResult =
  | { ok: false; state: "Gagal"; code: "INTEGRATION_DISABLED"; message: string }
  | {
      ok: true;
      state: "Diterima Penyedia";
      providerRequestId: string | null;
      providerStatus: number;
    };
export interface EmailProvider {
  connectMailbox(userId: string): Promise<{ ok: false; message: string }>;
  getConnectionStatus(): { state: ConnectionState; message: string };
  sendNotificationEmail(message: MailMessage): Promise<MailResult>;
  sendCommercialEmail(
    message: MailMessage,
    confirmation: { userId: string; confirmed: boolean },
  ): Promise<MailResult>;
}
