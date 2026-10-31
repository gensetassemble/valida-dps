export const REQUEST_STATUSES = {
  draft: "Pengajuan lama",
  awaiting_signatures: "Sedang Diajukan",
  submitted: "Sedang Diajukan",
  correction: "Sedang Diajukan",
  accepted: "Sedang Diproses",
  completed: "Selesai",
  cancelled: "Dibatalkan",
} as const;
export const RENEWAL_STATUSES = {
  unprocessed: "Belum Diproses",
  processing: "Sedang Diproses",
  renewed: "Sudah Diperpanjang",
} as const;
export function personnelRenewalDisplay(
  status: string | null | undefined,
  validity: string,
  lifetime = false,
) {
  if (lifetime) return null;
  const actual = status || "unprocessed";
  if (
    actual === "unprocessed" &&
    !["Expired", "Kritis", "Perhatian", "Pantau"].includes(validity)
  )
    return null;
  return Object.hasOwn(RENEWAL_STATUSES, actual)
    ? (actual as keyof typeof RENEWAL_STATUSES)
    : null;
}
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
