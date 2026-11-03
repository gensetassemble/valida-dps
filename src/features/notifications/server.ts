import "server-only";
import { requireActiveUser } from "@/lib/auth/guards";
import { masterClient } from "@/features/master-data/server";
import { safeSearch } from "@/features/master-data/validation";
import {
  CATEGORIES,
  PAGE_SIZE,
  type Category,
  type Counts,
  type Feed,
  type Filters,
  type Notification,
} from "./model";

export function parseInboxParams(
  params: Record<string, string | string[] | undefined>,
) {
  const category =
    typeof params.category === "string" &&
    Object.hasOwn(CATEGORIES, params.category)
      ? (params.category as Category)
      : "all";
  const state =
    params.state === "unread" || params.state === "read" ? params.state : "all";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const page = Math.max(
    1,
    Math.min(100000, Math.floor(Number(params.page) || 1)),
  );
  return { filters: { category, state, q } as Filters, page };
}

export async function loadInbox(filters: Filters, page: number) {
  const { user } = await requireActiveUser();
  const db = await masterClient();
  let query = db
    .from("notification_inbox_records")
    .select(
      "id,category,title,event_status,current_status,context_name,entity_title,reference_number,replacement_certificate_number,portfolio_code,expires_on,event_notes,target_href,activity_group_id,process_reset,read_at,created_at",
      { count: "exact" },
    )
    .eq("profile_id", user.id);
  if (filters.category !== "all")
    query = query.eq("category", filters.category);
  if (filters.state === "unread") query = query.is("read_at", null);
  if (filters.state === "read") query = query.not("read_at", "is", null);
  for (const term of safeSearch(filters.q)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8))
    query = query.ilike("search_text", `%${term}%`);
  const keys = [
    "all",
    "unread",
    ...Object.keys(CATEGORIES),
  ] as (keyof Counts)[];
  const [result, ...totals] = await Promise.all([
    query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    ...keys.map((key) => {
      let count = db
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", user.id)
        .is("archived_at", null);
      if (key === "unread") count = count.is("read_at", null);
      else if (key === "personnel")
        count = count.like("href", "/kompetensi-personil/%");
      else if (key === "calibrations")
        count = count.like("href", "/kalibrasi-alat/%");
      else if (key === "clients")
        count = count.like("href", "/sertifikat-klien/%");
      else if (key === "system")
        count = count
          .not("href", "like", "/kompetensi-personil/%")
          .not("href", "like", "/kalibrasi-alat/%")
          .not("href", "like", "/sertifikat-klien/%");
      return count;
    }),
  ]);
  if (result.error || totals.some((r) => r.error))
    throw Error("Pusat Notifikasi belum dapat dimuat. Silakan coba kembali.");
  const counts = Object.fromEntries(
    keys.map((key, i) => [key, totals[i].count || 0]),
  ) as Counts;
  const offset = (page - 1) * PAGE_SIZE;
  return {
    counts,
    feed: {
      rows: (result.data || []) as Notification[],
      total: result.count || 0,
      offset,
      hasMore: offset + PAGE_SIZE < (result.count || 0),
    } as Feed,
  };
}
