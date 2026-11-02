import { todayWita } from "@/lib/domain/validity";

export const CATEGORIES = {
  clients: {
    label: "Sertifikat Klien",
    action: "Lihat Sertifikat",
    color: "#2563EB",
    soft: "#EFF6FF",
  },
  personnel: {
    label: "Kompetensi Personil",
    action: "Lihat Sertifikat",
    color: "#7C3AED",
    soft: "#F5F3FF",
  },
  calibrations: {
    label: "Kalibrasi Alat",
    action: "Lihat Alat",
    color: "#0F766E",
    soft: "#F0FDFA",
  },
  system: {
    label: "Sistem / Lainnya",
    action: "Lihat Detail",
    color: "#64748B",
    soft: "#F1F5F9",
  },
} as const;
export type Category = keyof typeof CATEGORIES;
export type Notification = {
  id: string;
  category: Category;
  title: string;
  event_status: string | null;
  context_name: string | null;
  entity_title: string | null;
  reference_number: string | null;
  replacement_certificate_number: string | null;
  portfolio_code: string | null;
  expires_on: string | null;
  event_notes: string | null;
  target_href: string | null;
  activity_group_id: string | null;
  process_reset: boolean;
  read_at: string | null;
  created_at: string;
};
export type Filters = {
  category: "all" | Category;
  state: "all" | "unread" | "read";
  q: string;
};
export type Counts = Record<"all" | "unread" | Category, number>;
export type Feed = {
  rows: Notification[];
  total: number;
  offset: number;
  hasMore: boolean;
};
export const PAGE_SIZE = 25;
export const DATE_GROUPS = [
  "Hari Ini",
  "Kemarin",
  "7 Hari Terakhir",
  "Lebih Lama",
] as const;
export function dateGroup(createdAt: string, now = new Date()) {
  const day = todayWita(new Date(createdAt));
  const delta = Math.round(
    (Date.parse(todayWita(now)) - Date.parse(day)) / 86400000,
  );
  return delta <= 0
    ? DATE_GROUPS[0]
    : delta === 1
      ? DATE_GROUPS[1]
      : delta < 7
        ? DATE_GROUPS[2]
        : DATE_GROUPS[3];
}
export const EVENT_LABELS: Record<string, string> = {
  unprocessed: "Belum Diproses",
  processing: "Sedang Diproses",
  renewed: "Sudah Diperpanjang",
  cancelled: "Dibatalkan",
  draft: "Draf",
  awaiting_signatures: "Sedang Diajukan",
  submitted: "Sedang Diajukan",
  correction: "Perlu Perbaikan",
  accepted: "Sedang Diproses",
  completed: "Selesai",
};
export function eventLabel(n: Notification) {
  return (
    (n.event_status && EVENT_LABELS[n.event_status]) ||
    (/expired|kedaluwarsa/i.test(n.title)
      ? "Expired"
      : /kritis/i.test(n.title)
        ? "Kritis"
        : /perhatian/i.test(n.title)
          ? "Perhatian"
          : "Pemberitahuan")
  );
}
export function eventTone(n: Notification) {
  const label = eventLabel(n);
  return label === "Sudah Diperpanjang" || label === "Selesai"
    ? "success"
    : label === "Sedang Diproses" || label === "Sedang Diajukan"
      ? "info"
      : label === "Dibatalkan" || label === "Expired"
        ? "danger"
        : label === "Kritis" || label === "Perhatian"
          ? "warning"
          : "neutral";
}
export function shortTitle(n: Notification) {
  if (n.category === "personnel" && n.entity_title) {
    if (!n.event_status) return n.title;
    return n.event_status === "renewed"
      ? `Sertifikat ${n.entity_title} diperpanjang`
      : `Perpanjangan ${n.entity_title} ${n.event_status === "processing" ? "sedang diproses" : n.event_status === "cancelled" ? "dibatalkan" : "belum diproses"}`;
  }
  if (n.category === "calibrations" && n.entity_title)
    return n.event_status
      ? `Permintaan perbaikan / kalibrasi ${n.entity_title}`
      : `${n.entity_title} — ${n.title}`;
  return n.title;
}
export function safeTarget(href: string | null) {
  return href &&
    /^\/(?!\/)/.test(href) &&
    !href.includes("\\") &&
    !Array.from(href).some(
      (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
    )
    ? href
    : null;
}
export function clusters(rows: Notification[], now = new Date()) {
  const groups = new Map<string, { date: string; events: Notification[] }>();
  for (const row of rows) {
    const date = dateGroup(row.created_at, now);
    const key = `${date}:${row.category}:${row.activity_group_id || row.id}`;
    const group = groups.get(key) || { date, events: [] };
    group.events.push(row);
    groups.set(key, group);
  }
  return [...groups.values()];
}
