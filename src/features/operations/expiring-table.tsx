"use client";
import { useState } from "react";
import Link from "next/link";
import { Award, FileCheck2, Wrench, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DeadlineDate } from "@/components/ui/deadline-date";
import { remainingDays } from "@/lib/domain/validity";
import {
  filterPriorities,
  PRIORITY_CATEGORIES,
  type ExpiringItem,
} from "./expiring-priorities";
const icons = { calibrations: Wrench, personnel: Award, clients: FileCheck2 };
const routes: Record<string, string> = {
  calibrations: "/kalibrasi-alat",
  personnel: "/kompetensi-personil",
  clients: "/sertifikat-klien",
};
export function ExpiringTable({
  items,
  branch,
  today,
}: {
  items: ExpiringItem[];
  branch: string;
  today: string;
}) {
  const [query, setQuery] = useState(""),
    [domain, setDomain] = useState(""),
    [portfolio, setPortfolio] = useState("");
  const filtered = filterPriorities(items, query, domain, portfolio);
  const categories = [...new Set(items.map((i) => i.domain))];
  const portfolios = [
    ...new Set(
      items.map((i) => i.portfolio_code).filter((s): s is string => !!s),
    ),
  ].sort();
  const active = !!(query || domain || portfolio);
  return (
    <Card className="mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-brand-navy">
            Segera Berakhir{" "}
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              {filtered.length} item
            </span>
          </h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Maksimal 20 prioritas dalam 90 hari, sesuai akses dan filter
            dashboard.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-white px-2.5 sm:w-56">
            <Search size={14} className="shrink-0 text-muted-foreground" />
            <span className="sr-only">Cari dalam daftar segera berakhir</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, nomor, penanggung jawab…"
              className="h-9 w-full min-w-0 bg-transparent text-xs outline-none"
            />
          </label>
          {categories.length > 1 && (
            <select
              aria-label="Kategori segera berakhir"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="h-9 rounded-lg border border-input bg-white px-2 text-xs"
            >
              <option value="">Semua kategori</option>
              {categories.map((key) => (
                <option key={key} value={key}>
                  {PRIORITY_CATEGORIES[key]?.label || key}
                </option>
              ))}
            </select>
          )}
          {portfolios.length > 1 && (
            <select
              aria-label="Portofolio segera berakhir"
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
              className="h-9 rounded-lg border border-input bg-white px-2 text-xs"
            >
              <option value="">Semua portofolio</option>
              {portfolios.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          )}
          {active && (
            <button
              type="button"
              aria-label="Reset filter daftar segera berakhir"
              onClick={() => {
                setQuery("");
                setDomain("");
                setPortfolio("");
              }}
              className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs text-primary-hover hover:bg-emerald-50"
            >
              <X size={13} />
              Reset
            </button>
          )}
        </div>
      </div>
      <div
        className="relative max-h-[560px] overflow-auto"
        role="region"
        aria-label="Daftar segera berakhir"
        tabIndex={0}
      >
        <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-brand-navy">
            <tr>
              {[
                "Kategori",
                "Entitas / alat",
                "Jenis sertifikat / uji",
                "Nomor sertifikat",
                "Tanggal akhir",
                "Sisa hari",
                "Status",
                "Penanggung jawab",
              ].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="border-b border-border px-3 py-2.5 font-bold"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const category = PRIORITY_CATEGORIES[item.domain],
                Icon = icons[item.domain as keyof typeof icons] || FileCheck2,
                days = remainingDays(item.expiry_date, today);
              return (
                <tr
                  key={item.domain + item.id}
                  className="group hover:bg-slate-50/80"
                >
                  <td className="border-b border-slate-100 px-3 py-3">
                    <span
                      className={`inline-flex max-w-28 items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${category?.className || "bg-slate-50 text-slate-700"}`}
                    >
                      <Icon size={13} className="shrink-0" />
                      {category?.label || item.domain}
                    </span>
                  </td>
                  <td className="max-w-56 border-b border-slate-100 px-3 py-3">
                    <Link
                      href={`${routes[item.domain]}/${item.id}?branch=${encodeURIComponent(branch)}`}
                      className="line-clamp-2 font-semibold text-brand-navy hover:text-primary-hover hover:underline"
                      title={item.entity_name}
                    >
                      {item.entity_name}
                      {item.is_example ? " [CONTOH]" : ""}
                    </Link>
                    {item.domain === "calibrations" && (
                      <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">
                        {item.title || "Tag belum dicatat"}
                        <br />
                        {[
                          item.portfolio_code &&
                            `Portofolio ${item.portfolio_code}`,
                          item.location,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="max-w-56 border-b border-slate-100 px-3 py-3">
                    <span
                      className="line-clamp-2 leading-5"
                      title={item.certificate_kind || ""}
                    >
                      {item.certificate_kind || "Belum dicatat"}
                    </span>
                  </td>
                  <td className="max-w-44 break-words border-b border-slate-100 px-3 py-3 font-mono text-[11px]">
                    {item.reference_number || "Belum dicatat"}
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3">
                    <DeadlineDate value={item.expiry_date} />
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold tabular-nums ${days !== null && days < 0 ? "bg-red-50 text-red-700" : days !== null && days <= 30 ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}
                    >
                      {days === null
                        ? "—"
                        : days < 0
                          ? `Lewat ${Math.abs(days)} hari`
                          : `${days} hari`}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    <StatusBadge value={item.validity_status} />
                  </td>
                  <td className="max-w-48 border-b border-slate-100 px-3 py-3">
                    <span
                      className="line-clamp-2"
                      title={item.responsible_name || ""}
                    >
                      {item.responsible_name ||
                        (item.responsible_id
                          ? "Nama tidak tersedia"
                          : "Belum ditetapkan")}
                    </span>
                    {item.domain === "personnel" && (
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        Pemilik sertifikat
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && (
          <p className="p-7 text-center text-sm text-muted-foreground">
            {items.length
              ? "Tidak ada prioritas yang cocok dengan pencarian/filter ini."
              : "Belum ada rekaman berjangka yang berakhir dalam 90 hari pada cakupan ini."}
          </p>
        )}
      </div>
      <p className="border-t border-border bg-slate-50/50 px-4 py-2 text-[10px] text-muted-foreground">
        Menampilkan {filtered.length} dari {items.length} prioritas yang dimuat.
        Pencarian di sini hanya menyaring daftar ini; gunakan filter dashboard
        untuk mengubah cakupan.
      </p>
    </Card>
  );
}
