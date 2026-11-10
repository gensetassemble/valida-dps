"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Award,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  Inbox,
  RefreshCw,
  Search,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatBusinessDate, formatTimestamp } from "@/lib/format";
import { readNotifications, archiveNotifications } from "./actions";
import {
  CATEGORIES,
  DATE_GROUPS,
  clusters,
  eventLabel,
  eventTone,
  safeTarget,
  shortTitle,
  type Category,
  type Counts,
  type Feed,
  type Filters,
  type Notification,
} from "./model";
import styles from "./inbox.module.css";

const ICONS = {
  clients: FileCheck2,
  personnel: Award,
  calibrations: Wrench,
  system: Bell,
};
const time = (value: string) =>
  `${formatTimestamp(value).replace(",", " ·")} WITA`;

export function NotificationInbox({
  feed,
  counts,
  filters,
  page,
  now,
}: {
  feed: Feed;
  counts: Counts;
  filters: Filters;
  page: number;
  now: string;
}) {
  const router = useRouter(),
    params = useSearchParams(),
    toast = useToast();
  const [pending, start] = useTransition();
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState({
    base: filters.q,
    value: filters.q,
    requested: filters.q,
  });
  const q =
    search.base === filters.q || filters.q === search.requested
      ? search.value
      : filters.q;
  if (search.base !== filters.q)
    setSearch({ ...search, base: filters.q, value: q });
  const queryString = params.toString();
  useEffect(() => {
    function refresh() {
      if (document.visibilityState === "visible") start(() => router.refresh());
    }
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  function navigate(patch: Record<string, string>) {
    const next = new URLSearchParams(queryString);
    next.delete("page");
    Object.entries(patch).forEach(([key, value]) =>
      value && value !== "all" ? next.set(key, value) : next.delete(key),
    );
    const targetQuery = Object.hasOwn(patch, "q") ? patch.q.trim() : q.trim();
    if (targetQuery) next.set("q", targetQuery);
    else next.delete("q");
    setSearch((current) => ({
      ...current,
      value: targetQuery,
      requested: targetQuery,
    }));
    start(() => router.replace(`/notifikasi?${next}`, { scroll: false }));
  }
  async function archive(ids: string[]) {
    setSaving(true);
    try {
      const result = await archiveNotifications(ids, filters.folder !== "archive");
      if (result.error) toast(result.error, "error");
      else { toast(filters.folder === "archive" ? "Notifikasi dikembalikan ke inbox." : "Notifikasi diarsipkan untuk akun Anda."); start(() => router.refresh()); }
    } catch { toast("Arsip belum tersimpan. Silakan coba kembali.", "error"); }
    finally { setSaving(false); }
  }
  useEffect(() => {
    if (q.trim() === filters.q || q.trim() === search.requested) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(queryString);
      next.delete("page");
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      setSearch((current) => ({ ...current, requested: q.trim() }));
      start(() => router.replace(`/notifikasi?${next}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(timer);
  }, [q, filters.q, search.requested, queryString, router]);
  async function mark(ids: string[] | null) {
    setSaving(true);
    try {
      const result = await readNotifications(ids);
      if (result.error) toast(result.error, "error");
      else {
        toast(
          result.count
            ? `${result.count} notifikasi ditandai dibaca.`
            : "Status baca sudah terbaru.",
        );
        start(() => router.refresh());
      }
    } catch {
      toast("Status baca belum tersimpan. Silakan coba kembali.", "error");
    } finally {
      setSaving(false);
    }
  }
  const grouped = clusters(feed.rows, new Date(now));
  const pageHref = (value: number) => {
    const p = new URLSearchParams(queryString);
    p.set("page", String(value));
    return `/notifikasi?${p}`;
  };
  return (
    <section className={styles.center} aria-label="Pusat Notifikasi">
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.headerIcon}>
            <BellRing size={23} aria-hidden="true" />
          </span>
          <div>
            <p className={styles.eyebrow}>INBOX VALIDA</p>
            <h1>Pusat Notifikasi</h1>
            <p className={styles.subtitle}>
              Pantau pengingat masa berlaku dan perkembangan tindak lanjut.
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            aria-label="Refresh notifikasi"
            onClick={() => start(() => router.refresh())}
          >
            <RefreshCw
              aria-hidden="true"
              className={pending ? "animate-spin" : ""}
            />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving || counts.unread === 0 || filters.folder === "archive"}
            onClick={() => mark(null)}
          >
            <CheckCheck aria-hidden="true" />
            {saving ? "Menyimpan…" : "Tandai semua dibaca"}
          </Button>
        </div>
      </header>
      <div className={styles.toolbar}>
        <nav className="flex flex-wrap gap-2 border-b border-border p-3" aria-label="Folder notifikasi">
          <Button size="sm" variant={filters.folder !== "archive" ? "default" : "outline"} onClick={() => navigate({folder:"",state:"all"})}>Inbox</Button>
          <Button size="sm" variant={filters.folder === "archive" ? "default" : "outline"} onClick={() => navigate({folder:"archive",state:"all"})}>Arsip</Button>
          <span className="self-center text-[10px] text-muted-foreground">Arsip pribadi tidak menghapus proses atau notifikasi pengguna lain.</span>
        </nav>
        <nav className={styles.tabs} aria-label="Kategori notifikasi">
          <FilterChip
            active={filters.category === "all" && filters.state !== "unread"}
            count={counts.all}
            onClick={() => navigate({ category: "all", state: "all" })}
          >
            Semua
          </FilterChip>
          <FilterChip
            active={filters.category === "all" && filters.state === "unread"}
            count={counts.unread}
            onClick={() => navigate({ category: "all", state: "unread" })}
          >
            Belum Dibaca
          </FilterChip>
          {(
            Object.entries(CATEGORIES) as [
              Category,
              (typeof CATEGORIES)[Category],
            ][]
          ).map(([key, category]) => {
            const Icon = ICONS[key];
            return (
              <FilterChip
                key={key}
                active={filters.category === key}
                count={counts[key]}
                onClick={() => navigate({ category: key })}
              >
                <Icon size={14} aria-hidden="true" />
                {category.label}
              </FilterChip>
            );
          })}
        </nav>
        <div className={styles.searchRow}>
          <div className={styles.search}>
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Cari notifikasi</span>
            <input
              aria-label="Cari notifikasi"
              value={q}
              onChange={(e) =>
                setSearch((current) => ({ ...current, value: e.target.value }))
              }
              maxLength={100}
              placeholder="Cari nama, lisensi, nomor sertifikat, atau tag alat…"
            />
            {q && (
              <button
                type="button"
                aria-label="Hapus pencarian"
                onClick={() => {
                  setSearch((current) => ({
                    ...current,
                    value: "",
                    requested: "",
                  }));
                  navigate({ q: "" });
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <label className={styles.readFilter}>
            <span className="sr-only">Status baca</span>
            <select
              value={filters.state}
              onChange={(e) => navigate({ state: e.target.value })}
            >
              <option value="all">Semua status baca</option>
              <option value="unread">Belum dibaca</option>
              <option value="read">Sudah dibaca</option>
              <option value="active">Perlu tindak lanjut</option>
            </select>
          </label>
        </div>
      </div>
      <div className={styles.resultLine} aria-live="polite">
        <span>
          {pending
            ? "Memuat notifikasi…"
            : `${feed.total} pemberitahuan${filters.q ? " sesuai pencarian" : ""}`}
        </span>
        <span>{counts.unread} belum dibaca di inbox</span>
      </div>
      <div aria-busy={pending} className={pending ? styles.pending : undefined}>
        {!feed.rows.length ? (
          <div className={styles.empty}>
            <span>
              <Inbox size={27} aria-hidden="true" />
            </span>
            <h2>
              {counts.all === 0
                ? "Belum ada notifikasi"
                : filters.state === "unread" &&
                    filters.category === "all" &&
                    !filters.q
                  ? "Semua sudah dibaca"
                  : "Tidak ada notifikasi yang sesuai"}
            </h2>
            <p>
              {counts.all === 0
                ? "Pengingat dan perkembangan proses untuk akun Anda akan tampil di sini."
                : "Coba kategori atau kata pencarian lain. Riwayat notifikasi Anda tetap tersimpan."}
            </p>
            {counts.all > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate({ category: "all", state: "all", q: "" })
                }
              >
                Tampilkan semua
              </Button>
            )}
          </div>
        ) : (
          DATE_GROUPS.map((date) => {
            const items = grouped.filter((group) => group.date === date);
            if (!items.length) return null;
            return (
              <section
                key={date}
                className={styles.dateSection}
                aria-label={date}
              >
                <div className={styles.dateHeading}>
                  <h2>{date}</h2>
                  <span>
                    {items.reduce((n, g) => n + g.events.length, 0)} aktivitas
                    ditampilkan
                  </span>
                  <div />
                </div>
                <div className={styles.cards}>
                  {items.map((group) => (
                    <NotificationCard
                      key={group.events[0].id}
                      events={group.events}
                      saving={saving}
                      mark={mark}
                      archive={archive}
                      archived={filters.folder === "archive"}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
      {feed.total > 0 && (
        <footer className={styles.pagination}>
          <p>
            Menampilkan {feed.rows.length ? feed.offset + 1 : 0}–
            {feed.rows.length ? feed.offset + feed.rows.length : 0} dari{" "}
            {feed.total} aktivitas
          </p>
          <div>
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page - 1)}>
                  <ChevronLeft aria-hidden="true" />
                  Sebelumnya
                </Link>
              </Button>
            )}
            {feed.hasMore && (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page + 1)}>
                  Berikutnya
                  <ChevronRight aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
        </footer>
      )}
      <p className={styles.footnote}>
        Waktu ditampilkan dalam WITA. Status proses tidak mengubah masa berlaku
        sertifikat.
      </p>
    </section>
  );
}

function FilterChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${styles.chip} ${active ? styles.chipActive : ""}`}
    >
      {children}
      <span>{count}</span>
    </button>
  );
}

export function NotificationCard({
  events,
  saving,
  mark,
  archive,
  archived = false,
}: {
  events: Notification[];
  saving: boolean;
  mark: (ids: string[]) => Promise<void>;
  archive?: (ids: string[]) => Promise<void>;
  archived?: boolean;
}) {
  const n = events[0],
    category = CATEGORIES[n.category],
    Icon = ICONS[n.category];
  const unread = events.filter((e) => !e.read_at).map((e) => e.id),
    href = safeTarget(n.target_href);
  const title = shortTitle(n);
  return (
    <article
      className={`${styles.card} ${unread.length ? styles.unread : ""}`}
      style={
        {
          "--notice-accent": category.color,
          "--notice-soft": category.soft,
        } as React.CSSProperties
      }
    >
      <span className={styles.categoryIcon}>
        <Icon size={21} aria-hidden="true" />
      </span>
      <div className={styles.content}>
        <div className={styles.cardLabels}>
          <span className={styles.categoryLabel}>{category.label}</span>
          <span className={styles.badge} data-tone={eventTone(n)}>
            {eventLabel(n)}
          </span>
          {unread.length > 0 && (
            <span className={styles.unreadLabel}>
              <i aria-hidden="true" />
              Belum dibaca{unread.length > 1 ? ` (${unread.length})` : ""}
            </span>
          )}
        </div>
        <h3 className={styles.cardTitle} title={title}>
          {title}
        </h3>
        {n.context_name && n.category !== "calibrations" && (
          <p className={styles.context}>{n.context_name}</p>
        )}
        <p className={styles.metadata}>
          {n.portfolio_code && (
            <span>
              Portofolio {n.portfolio_code}
              <span aria-hidden="true"> · </span>
            </span>
          )}
          {n.reference_number
            ? `${n.category === "calibrations" ? "Tag Number" : "No. Sertifikat"} ${n.reference_number}`
            : "Nomor referensi belum tersedia"}
        </p>
        {n.replacement_certificate_number &&
          n.replacement_certificate_number !== n.reference_number && (
            <p className={styles.newNumber}>
              Nomor baru saat perpanjangan:{" "}
              <strong>{n.replacement_certificate_number}</strong>
            </p>
          )}
        {n.process_reset && (
          <p className={styles.resetNote}>
            Proses ini telah direset; detail merujuk sertifikat sebelum
            perpanjangan.
          </p>
        )}
        <time dateTime={n.created_at} className={styles.timestamp}>
          {time(n.created_at)}
        </time>
        <details className={styles.activity}>
          <summary>
            {events.length > 1
              ? `Lihat ${events.length} aktivitas di halaman ini`
              : "Lihat rincian"}
            <ChevronDown size={13} aria-hidden="true" />
          </summary>
          <ol>
            {events.map((event) => (
              <li key={event.id}>
                <div className={styles.activityHeading}>
                  <span
                    className={styles.badge}
                    data-tone={eventTone({ ...event, current_status: null })}
                  >
                    {eventLabel({ ...event, current_status: null })}
                  </span>
                  <time dateTime={event.created_at}>
                    {time(event.created_at)}
                  </time>
                </div>
                <p>{event.title}</p>
                {event.event_notes && (
                  <p className={styles.activityNote}>{event.event_notes}</p>
                )}
                {event.expires_on && (
                  <p className={styles.activityNote}>
                    Tanggal berakhir: {formatBusinessDate(event.expires_on)}
                  </p>
                )}
                {event.replacement_certificate_number && (
                  <p className={styles.activityNote}>
                    Nomor baru saat perpanjangan:{" "}
                    {event.replacement_certificate_number}
                  </p>
                )}
                {!event.read_at && (
                  <button
                    type="button"
                    disabled={saving}
                    className={styles.inlineRead}
                    onClick={() => mark([event.id])}
                  >
                    <Check size={13} aria-hidden="true" />
                    Tandai aktivitas ini dibaca
                  </button>
                )}
              </li>
            ))}
          </ol>
        </details>
      </div>
      <div className={styles.cardActions}>
        {archive && <Button size="sm" variant="outline" disabled={saving} onClick={() => archive(events.map(event => event.id))}>{archived ? "Kembalikan ke inbox" : "Arsipkan"}</Button>}
        {href ? (
          <Link
            href={href}
            className={styles.detailLink}
            aria-label={`${category.action}: ${n.context_name || n.entity_title || n.title} — ${n.entity_title || ""}`}
          >
            {category.action}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          <span className={styles.unavailable}>
            Detail tidak tersedia atau akses telah berubah.
          </span>
        )}
        {unread.length > 0 && !archived ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => mark(unread)}
            aria-label={`Tandai ${unread.length} aktivitas ${n.context_name || n.entity_title || category.label} dibaca`}
            className={styles.markRead}
          >
            <CheckCheck size={14} aria-hidden="true" />
            {unread.length > 1 ? "Tandai aktivitas dibaca" : "Tandai dibaca"}
          </button>
        ) : (
          <span className={styles.readState}>
            <CheckCheck size={14} aria-hidden="true" />
            {unread.length ? "Belum dibaca · diarsipkan" : "Sudah dibaca"}
          </span>
        )}
      </div>
    </article>
  );
}
