import Link from "next/link";
import {
  dashboardFilters,
  dashboardScope,
  MODULE_ACCESS,
} from "@/lib/auth/module-access";
import { DeadlineDate } from "@/components/ui/deadline-date";
import { ScrollMore } from "@/components/ui/scroll-more";
import { requireActiveUser } from "@/lib/auth/guards";
import { activeBranch } from "@/lib/auth/permissions";
import { masterClient, type QueryParams } from "@/features/master-data/server";
import { OperationalFilters } from "@/features/operations/filters";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatBusinessDate, formatRupiah } from "@/lib/format";
import { todayWita, remainingDays } from "@/lib/domain/validity";
type Item = {
  domain: string;
  id: string;
  entity_name: string;
  title: string | null;
  expiry_date: string;
  validity_status: string;
  is_example: boolean;
  portfolio_code?: string | null;
  location?: string | null;
};
type Summary = {
  total: number;
  example_count: number;
  buckets: Record<string, number>;
  soon: Item[];
  real_client_count: number;
  opportunity: string | null;
  records: Item[];
  lifetime_count: number;
  unfit_equipment_count: number;
};
const routes: Record<string, string> = {
  clients: "/sertifikat-klien",
  personnel: "/kompetensi-personil",
  calibrations: "/kalibrasi-alat",
};
function EquipmentContext({ item }: { item: Item }) {
  return item.domain === "calibrations" ? (
    <span className="mt-1.5 block space-y-0.5 text-[10px] text-muted-foreground">
      <span className="block">
        Portofolio: <strong>{item.portfolio_code || "Belum dipetakan"}</strong>
      </span>
      <span className="block">Lokasi: {item.location || "Belum dicatat"}</span>
    </span>
  ) : null;
}
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams & { category?: string; examples?: string }>;
}) {
  const requested = await searchParams,
    c = await requireActiveUser(),
    branch = activeBranch(c.scopes, c.profile.branch_code, requested.branch),
    db = await masterClient();
  const { domains, category } = dashboardScope(
    c.scopes,
    branch,
    requested.category,
  );
  const p = dashboardFilters(requested, category);
  const showClients =
    domains.includes("clients") && ["all", "clients"].includes(category);
  const showPersonnel =
    domains.includes("personnel") && ["all", "personnel"].includes(category);
  const showCalibrations =
    domains.includes("calibrations") &&
    ["all", "calibrations"].includes(category);
  const { data, error } = await db.rpc("operational_summary", {
    b: branch,
    filters: { ...p, scroll: "true" },
  });
  if (error) {
    console.error("Dashboard query failed", {
      code: error.code,
      message: error.message?.slice(0, 160),
    });
    throw Error("Ringkasan belum dapat dimuat dalam cakupan yang diminta.");
  }
  const s = data as Summary;
  const equipmentIds = [
    ...new Set(
      [...(s.soon || []), ...(s.records || [])]
        .filter((r) => r.domain === "calibrations")
        .map((r) => r.id),
    ),
  ];
  if (equipmentIds.length) {
    const { data: equipment, error } = await db
      .from("equipment_monitoring_records")
      .select("id,portfolio_code,location,unit")
      .eq("branch_code", branch)
      .in("id", equipmentIds);
    if (error) throw Error("Portofolio dan lokasi alat belum dapat dimuat.");
    const byId = new Map((equipment || []).map((e) => [String(e.id), e]));
    for (const item of [...(s.soon || []), ...(s.records || [])])
      if (item.domain === "calibrations") {
        const asset = byId.get(item.id);
        item.portfolio_code = asset?.portfolio_code;
        item.location = asset?.location || asset?.unit;
      }
  }
  const tabs = [
    ...(domains.length > 1 ? [["all", "Semua"]] : []),
    ...domains.map((d) => [d, MODULE_ACCESS[d].label]),
  ];
  return (
    <>
      <PageHeader
        title={
          domains.length === 1
            ? "Dashboard " + MODULE_ACCESS[domains[0]].label
            : "Dashboard"
        }
        eyebrow={
          "Cabang " + branch + " · " + formatBusinessDate(todayWita()) + " WITA"
        }
        description="Pemantauan masa berlaku dan tindak lanjut dari data yang dapat Anda akses."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            className={
              "rounded-lg border px-4 py-2 text-xs font-semibold " +
              ((p.category || "all") === key
                ? "border-brand-navy bg-brand-navy text-white"
                : "border-border bg-white")
            }
            href={
              "/dashboard?" +
              new URLSearchParams({ ...p, branch, category: key } as Record<
                string,
                string
              >)
            }
          >
            {label}
          </Link>
        ))}
      </div>
      <OperationalFilters
        clearPath="/dashboard"
        entity={
          p.category === "personnel"
            ? "kompetensi-personil"
            : p.category === "calibrations"
              ? "kalibrasi-alat"
              : p.category === "clients"
                ? "sertifikat-klien"
                : "dashboard-all"
        }
        branch={branch}
        params={p}
      />
      <div className="mb-5 flex flex-wrap justify-between gap-3 text-xs">
        <p>{s.total} rekaman aktif sesuai akses dan filter.</p>
        {showClients && (
          <Link
            className="underline"
            href={
              "/dashboard?" +
              new URLSearchParams({
                ...p,
                branch,
                examples: p.examples === "true" ? "false" : "true",
              } as Record<string, string>)
            }
          >
            {p.examples === "true"
              ? "Sembunyikan data [CONTOH]"
              : "Tampilkan juga data [CONTOH]"}
          </Link>
        )}
      </div>
      {s.example_count > 0 && (
        <p className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs">
          Tampilan mencakup {s.example_count} rekaman [CONTOH]. Nilai peluang
          riil selalu mengecualikan data contoh.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          "Expired",
          "Kritis",
          "Perhatian",
          "Pantau",
          "Aman",
          "Tanggal Belum Diisi",
          "Berlaku Seumur Hidup",
        ]
          .filter(
            (status) => status !== "Berlaku Seumur Hidup" || showPersonnel,
          )
          .map((status) => (
            <Link
              key={status}
              href={
                "/dashboard?" +
                new URLSearchParams({
                  ...p,
                  branch,
                  validity: status,
                  page: "1",
                } as Record<string, string>)
              }
            >
              <Card className="p-4">
                <StatusBadge value={status} />
                <strong className="mt-4 block text-3xl tabular-nums text-brand-navy">
                  {s.buckets[status] || 0}
                </strong>
              </Card>
            </Link>
          ))}
        {showClients && (
          <Card className="p-4">
            <p className="text-xs font-semibold text-muted-foreground">
              Nilai Peluang Perpanjangan
            </p>
            <strong className="mt-4 block text-xl tabular-nums text-primary-hover">
              {s.real_client_count
                ? formatRupiah(s.opportunity || "0")
                : "Belum ada data"}
            </strong>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Sertifikat klien yang berakhir dalam 90 hari; data contoh
              dikecualikan.
            </p>
          </Card>
        )}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {showPersonnel && (
          <Link
            href={
              "/dashboard?branch=" +
              branch +
              "&category=personnel&kind=lifetime"
            }
          >
            <Card className="p-4">
              <p className="text-xs font-semibold">Kompetensi seumur hidup</p>
              <strong className="mt-2 block text-2xl tabular-nums">
                {s.lifetime_count || 0}
              </strong>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Terpisah dari bucket expired dan pengingat.
              </p>
            </Card>
          </Link>
        )}
        {showCalibrations && (
          <Link
            href={
              "/kalibrasi-alat?branch=" +
              branch +
              "&eligibility=" +
              encodeURIComponent("Tidak Layak Pakai")
            }
          >
            <Card className="p-4">
              <StatusBadge value="Tidak Layak Pakai" />
              <strong className="mt-2 block text-2xl tabular-nums text-red-900">
                {s.unfit_equipment_count || 0}
              </strong>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Masa berlaku yang belum berakhir tidak mengesampingkan hasil
                kalibrasi gagal.
              </p>
            </Card>
          </Link>
        )}
      </div>
      {(p.validity || p.kind) && (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-border p-5">
            <h2 className="text-sm font-bold">Rekaman Sesuai Filter</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {s.total} rekaman sesuai kewenangan. Baris berikutnya dimuat saat
              discroll.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-4">Pemilik / objek</th>
                  <th className="p-4">Nomor / judul</th>
                  <th className="p-4">Tanggal akhir</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {(s.records || []).map((r) => (
                  <tr key={r.domain + r.id} className="border-t border-border">
                    <td className="p-4">
                      {r.entity_name}
                      <EquipmentContext item={r} />
                    </td>
                    <td className="p-4">
                      <Link
                        className="text-primary-hover underline"
                        href={
                          routes[r.domain] + "/" + r.id + "?branch=" + branch
                        }
                      >
                        {r.title || "Lihat rekaman"}
                      </Link>
                    </td>
                    <td className="p-4">
                      {<DeadlineDate value={r.expiry_date} />}
                    </td>
                    <td className="p-4">
                      <StatusBadge value={r.validity_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!s.records?.length && (
              <p className="p-5 text-sm">Belum ada data sesuai filter.</p>
            )}
          </div>
          <ScrollMore
            shown={s.records?.length || 0}
            total={Math.min(1000, s.total)}
            href={
              "?" +
              new URLSearchParams({
                ...p,
                branch,
                page: String(Number(p.page || 1) + 1),
              } as Record<string, string>)
            }
          />
        </Card>
      )}
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-border p-5">
          <h2 className="text-sm font-bold">Segera Berakhir</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            20 rekaman terdekat dalam 90 hari kalender. Lifetime dan tanggal
            belum diisi tidak masuk daftar ini.
          </p>
        </div>
        {s.soon.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-4">Pemilik / objek</th>
                  <th className="p-4">Sertifikat / alat</th>
                  <th className="p-4">Tanggal akhir</th>
                  <th className="p-4">Sisa hari</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {s.soon.map((r) => (
                  <tr key={r.domain + r.id} className="border-t border-border">
                    <td className="p-4">
                      {r.entity_name}
                      <EquipmentContext item={r} />
                    </td>
                    <td className="p-4">
                      <Link
                        className="font-semibold text-primary-hover underline"
                        href={
                          routes[r.domain] + "/" + r.id + "?branch=" + branch
                        }
                      >
                        {r.title || "Lihat rekaman"}
                        {r.is_example ? " [CONTOH]" : ""}
                      </Link>
                    </td>
                    <td className="p-4">
                      {<DeadlineDate value={r.expiry_date} />}
                    </td>
                    <td className="p-4 tabular-nums">
                      {remainingDays(r.expiry_date)} hari
                    </td>
                    <td className="p-4">
                      <StatusBadge value={r.validity_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Belum ada data yang segera berakhir dalam cakupan ini.
          </div>
        )}
      </Card>
    </>
  );
}
