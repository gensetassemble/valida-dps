export type QcDomain = "calibration" | "personnel";
export const QC_MAX_FINDINGS = 20;
export type QcFindingDraft = { requestId: string; title: string; body: string };
export const QC_STATUSES = {
  open: "Perlu ditindaklanjuti",
  in_progress: "Ditindaklanjuti",
  awaiting_qshe: "Menunggu QSHE",
  closed: "Selesai",
} as const;
export type QcThread = {
  id: string; title: string; status: keyof typeof QC_STATUSES;
  version: number; recipient_names: string[]; created_at: string; updated_at: string;
};
export type QcPost = {
  id: string; author_name: string; operation: string; body: string;
  resulting_status: string; document_id: string | null; created_at: string;
};
export const QC_EVENTS: Record<string,string> = {
  open: "Membuka temuan", reply: "Membalas", request_review: "Meminta pemeriksaan QSHE",
  close: "Menyelesaikan temuan", reopen: "Membuka kembali temuan",
};
