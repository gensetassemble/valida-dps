export const REQUEST_STATUSES = {
  draft: "Draf",
  awaiting_signatures: "Menunggu Tanda Tangan",
  submitted: "Diajukan ke PTK",
  correction: "Perlu Perbaikan Dokumen",
  accepted: "Diterima PTK",
  completed: "Selesai",
  cancelled: "Dibatalkan",
} as const;
export const RENEWAL_STATUSES = {
  unprocessed: "Belum Diproses",
  processing: "Sedang Diproses",
  renewed: "Sudah Diperpanjang",
} as const;
export function requestTransitions(
  status: string,
  requester: boolean,
  ptk: boolean,
): string[] {
  return [
    ...(requester
      ? (
          {
            draft: ["awaiting_signatures", "cancelled"],
            awaiting_signatures: ["submitted", "cancelled"],
            correction: ["awaiting_signatures", "submitted", "cancelled"],
          } as Record<string, string[]>
        )[status] || []
      : []),
    ...(ptk
      ? (
          {
            submitted: ["accepted", "correction"],
            accepted: ["completed", "correction", "cancelled"],
          } as Record<string, string[]>
        )[status] || []
      : []),
  ];
}
export function renewalTransitions(status: string): string[] {
  return status === "unprocessed"
    ? ["processing"]
    : status === "processing"
      ? ["renewed"]
      : [];
}
