import Link from "next/link";
import { Award, FileCheck2, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DeadlineDate } from "@/components/ui/deadline-date";
import { remainingDays } from "@/lib/domain/validity";
import { PRIORITY_CATEGORIES, type ExpiringItem } from "./expiring-priorities";
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
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-brand-navy">
            Segera Berakhir &amp; Expired
          </h2>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Maksimal 20 expired dan 20 yang berakhir dalam 90 hari, sesuai akses
            akun.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800">
          {items.length} item
        </span>
      </div>
      <div
        className="relative max-h-[480px] overflow-auto"
        role="region"
        aria-label="Daftar segera berakhir dan expired"
        tabIndex={0}
      >
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-brand-navy">
            <tr>
              {[
                "Kategori",
                "Entitas / alat",
                "Jenis sertifikat / uji",
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
            {items.map((item) => {
              const category = PRIORITY_CATEGORIES[item.domain],
                Icon = icons[item.domain as keyof typeof icons] || FileCheck2,
                days = remainingDays(item.expiry_date, today);
              return (
                <tr
                  key={item.domain + item.id}
                  className="hover:bg-slate-50/80"
                >
                  <td className="border-b border-slate-100 px-3 py-2.5">
                    <span
                      className={`inline-flex max-w-28 items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${category?.className || "bg-slate-50 text-slate-700"}`}
                    >
                      <Icon size={13} className="shrink-0" />
                      {category?.label || item.domain}
                    </span>
                  </td>
                  <td className="max-w-56 border-b border-slate-100 px-3 py-2.5">
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
                  <td className="max-w-56 border-b border-slate-100 px-3 py-2.5">
                    <span
                      className="line-clamp-2 leading-5"
                      title={item.certificate_kind || ""}
                    >
                      {item.certificate_kind || "Belum dicatat"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2.5">
                    <DeadlineDate value={item.expiry_date} />
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2.5">
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
                  <td className="border-b border-slate-100 px-3 py-2.5">
                    <StatusBadge value={item.validity_status} />
                  </td>
                  <td className="max-w-48 border-b border-slate-100 px-3 py-2.5">
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
        {!items.length && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Belum ada rekaman yang berakhir dalam 90 hari pada cakupan akun ini.
          </p>
        )}
      </div>
    </Card>
  );
}
