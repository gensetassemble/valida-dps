import Link from "next/link";
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
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams & { category?: string; examples?: string }>;
}) {
  const p = await searchParams,
    c = await requireActiveUser(),
    branch = activeBranch(c.scopes, c.profile.branch_code, p.branch),
    db = await masterClient();
  const { data, error } = await db.rpc("operational_summary", {
    b: branch,
    filters: p,
  });
  if (error)
    throw Error("Ringkasan belum dapat dimuat dalam cakupan yang diminta.");
  const s = data as Summary;
  const tabs = [
    ["all", "Semua"],
    ["clients", "Sertifikat Klien"],
    ["personnel", "Kompetensi Personil"],
    ["calibrations", "Kalibrasi Alat"],
  ];
  return (
    <>
      <PageHeader
        title="Dashboard"
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
              : "sertifikat-klien"
        }
        branch={branch}
        params={p}
      />
      <div className="mb-5 flex flex-wrap justify-between gap-3 text-xs">
        <p>{s.total} rekaman aktif sesuai akses dan filter.</p>
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
      </div>
      {s.example_count > 0 && (
        <p className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs">
          Tampilan mencakup {s.example_count} rekaman [CONTOH]. Nilai peluang
          riil selalu mengecualikan data contoh.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          "Kedaluwarsa",
          "Kritis",
          "Perhatian",
          "Pantau",
          "Aman",
          "Perlu Verifikasi",
          "Berlaku Seumur Hidup",
        ].map((status) => (
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
            Sertifikat klien terverifikasi yang berakhir dalam 90 hari; data
            contoh dikecualikan.
          </p>
        </Card>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Link
          href={
            "/dashboard?branch=" + branch + "&category=personnel&kind=lifetime"
          }
        >
          <Card className="p-4">
            <p className="text-xs font-semibold">
              Kompetensi seumur hidup · seluruh status verifikasi
            </p>
            <strong className="mt-2 block text-2xl tabular-nums">
              {s.lifetime_count || 0}
            </strong>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Terpisah dari bucket kedaluwarsa dan pengingat.
            </p>
          </Card>
        </Link>
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
      </div>
      {(p.validity || p.kind) && (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-border p-5">
            <h2 className="text-sm font-bold">Rekaman Sesuai Filter</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {s.total} rekaman sesuai kewenangan. Maksimum 20 per halaman.
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
                    <td className="p-4">{r.entity_name}</td>
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
                    <td className="p-4">{formatBusinessDate(r.expiry_date)}</td>
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
          <div className="flex justify-end gap-4 border-t border-border p-4 text-xs">
            {Number(p.page || 1) > 1 && (
              <Link
                href={
                  "?" +
                  new URLSearchParams({
                    ...p,
                    branch,
                    page: String(Number(p.page) - 1),
                  } as Record<string, string>)
                }
              >
                Sebelumnya
              </Link>
            )}
            {Number(p.page || 1) * 20 < s.total && (
              <Link
                href={
                  "?" +
                  new URLSearchParams({
                    ...p,
                    branch,
                    page: String(Number(p.page || 1) + 1),
                  } as Record<string, string>)
                }
              >
                Berikutnya
              </Link>
            )}
          </div>
        </Card>
      )}
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-border p-5">
          <h2 className="text-sm font-bold">Segera Berakhir</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            20 rekaman terdekat dalam 90 hari kalender. Lifetime dan tanggal
            belum diverifikasi tidak masuk daftar ini.
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
                    <td className="p-4">{r.entity_name}</td>
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
                    <td className="p-4">{formatBusinessDate(r.expiry_date)}</td>
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
            Belum ada data terverifikasi yang segera berakhir dalam cakupan ini.
          </div>
        )}
      </Card>
    </>
  );
}
