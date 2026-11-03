import Link from "next/link";
import {
  dashboardFilters,
  dashboardScope,
  MODULE_ACCESS,
} from "@/lib/auth/module-access";
import { requireActiveUser } from "@/lib/auth/guards";
import { activeBranch } from "@/lib/auth/permissions";
import { masterClient, type QueryParams } from "@/features/master-data/server";
import { ExpiringTable } from "@/features/operations/expiring-table";
import type { ExpiringItem } from "@/features/operations/expiring-priorities";
import { Card } from "@/components/ui/card";
import { formatBusinessDate, formatRupiah } from "@/lib/format";
import { todayWita } from "@/lib/domain/validity";
import { DashboardOverview } from "@/features/operations/dashboard-overview";
type Item = ExpiringItem;
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
  const requested = await searchParams,
    c = await requireActiveUser(),
    branch = activeBranch(c.scopes, c.profile.branch_code, requested.branch),
    db = await masterClient();
  const { domains, category } = dashboardScope(c.scopes, branch);
  const p = dashboardFilters({}, category);
  const showClients =
    domains.includes("clients") && ["all", "clients"].includes(category);
  const showCalibrations =
    domains.includes("calibrations") &&
    ["all", "calibrations"].includes(category);
  const { data, error } = await db.rpc("operational_summary", {
    b: branch,
    filters: { ...p },
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
      (s.soon || [])
        .filter((r) => r.domain === "calibrations")
        .map((r) => r.id),
    ),
  ];
  if (equipmentIds.length) {
    const { data: equipment, error } = await db
      .from("equipment_monitoring_records")
      .select(
        "id,portfolio_id,portfolio_code,location,unit,monitoring_certificate,responsible_employee_id",
      )
      .eq("branch_code", branch)
      .in("id", equipmentIds);
    if (error) throw Error("Portofolio dan lokasi alat belum dapat dimuat.");
    const byId = new Map((equipment || []).map((e) => [String(e.id), e]));
    const priorityPortfolios = [
      ...new Set(
        s.soon
          .filter((r) => r.domain === "calibrations")
          .map((r) => byId.get(r.id)?.portfolio_id)
          .filter((id): id is string => !!id),
      ),
    ];
    const { data: coordinators, error: coordinatorError } =
      priorityPortfolios.length
        ? await db
            .from("portfolio_coordinators")
            .select(
              "portfolio_id,coordinator:operational_coordinators(full_name,is_active)",
            )
            .eq("branch_code", branch)
            .in("portfolio_id", priorityPortfolios)
            .eq("is_active", true)
            .lte("effective_from", todayWita())
            .or("effective_until.is.null,effective_until.gte." + todayWita())
        : { data: [], error: null };
    if (coordinatorError)
      throw Error("Koordinator prioritas alat belum dapat dimuat.");
    for (const item of s.soon || [])
      if (item.domain === "calibrations") {
        const asset = byId.get(item.id);
        item.portfolio_code = asset?.portfolio_code;
        item.location = asset?.location || asset?.unit;
        item.reference_number = asset?.monitoring_certificate;
        item.certificate_kind = "Sertifikat Kalibrasi";
        item.responsible_id = asset?.responsible_employee_id;
        if (!item.responsible_id) {
          const contact = coordinators?.find(
            (p) => p.portfolio_id === asset?.portfolio_id,
          )?.coordinator as unknown as {
            full_name: string;
            is_active: boolean;
          } | null;
          if (contact?.is_active) item.responsible_name = contact.full_name;
        }
      }
  }
  // Enrich only the 20 server-selected priorities; every query keeps source RLS and branch scope.
  const personnelIds = s.soon
    .filter((r) => r.domain === "personnel")
    .map((r) => r.id);
  const clientIds = s.soon
    .filter((r) => r.domain === "clients")
    .map((r) => r.id);
  const [personnel, clients] = await Promise.all([
    personnelIds.length
      ? db
          .from("personnel_certificate_records")
          .select(
            "id,employee_name,original_title,certificate_type_name,certificate_number",
          )
          .eq("branch_code", branch)
          .in("id", personnelIds)
      : Promise.resolve({ data: [], error: null }),
    clientIds.length
      ? db
          .from("client_certificate_records")
          .select(
            "id,certificate_type_name,certificate_number,account_manager_id",
          )
          .eq("branch_code", branch)
          .in("id", clientIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (personnel.error || clients.error)
    throw Error("Detail prioritas masa berlaku belum dapat dimuat.");
  for (const item of s.soon) {
    const certificate = personnel.data?.find((r) => r.id === item.id);
    if (certificate) {
      item.reference_number = certificate.certificate_number;
      item.certificate_kind =
        certificate.original_title || certificate.certificate_type_name;
      item.responsible_name = certificate.employee_name;
    }
    const client = clients.data?.find((r) => r.id === item.id);
    if (client) {
      item.reference_number = client.certificate_number;
      item.certificate_kind = client.certificate_type_name;
      item.responsible_id = client.account_manager_id;
    }
  }
  const employeeIds = [
    ...new Set(
      s.soon
        .filter((r) => r.domain === "calibrations" && r.responsible_id)
        .map((r) => r.responsible_id!),
    ),
  ];
  const managerIds = [
    ...new Set(
      s.soon
        .filter((r) => r.domain === "clients" && r.responsible_id)
        .map((r) => r.responsible_id!),
    ),
  ];
  const [employees, managers] = await Promise.all([
    employeeIds.length
      ? db
          .from("employee_directory")
          .select("id,full_name")
          .eq("branch_code", branch)
          .in("id", employeeIds)
      : Promise.resolve({ data: [], error: null }),
    managerIds.length
      ? db
          .from("profiles")
          .select("id,full_name")
          .eq("branch_code", branch)
          .in("id", managerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (employees.error || managers.error)
    throw Error("Penanggung jawab prioritas belum dapat dimuat.");
  for (const item of s.soon) {
    if (item.domain === "calibrations" && item.responsible_id)
      item.responsible_name = employees.data?.find(
        (e) => e.id === item.responsible_id,
      )?.full_name;
    if (item.domain === "clients")
      item.responsible_name = managers.data?.find(
        (e) => e.id === item.responsible_id,
      )?.full_name;
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary-hover">
            Cabang {branch} · {formatBusinessDate(todayWita())} WITA
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-navy">
            Dashboard
          </h1>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Ringkasan sesuai akses akun · Bali, NTB, NTT
        </p>
      </div>
      <DashboardOverview
        total={s.total}
        buckets={s.buckets}
        lifetime={s.lifetime_count}
        unfit={s.unfit_equipment_count}
        showCalibrations={showCalibrations}
      />
      {showClients && (
        <Card className="border-brand-navy bg-brand-navy px-4 py-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">
                Peluang Perpanjangan Komersial
              </h2>
              <p className="mt-1 text-[11px] text-slate-300">
                Sertifikat klien yang akan berakhir dalam 90 hari; data contoh
                dikecualikan.
              </p>
            </div>
            <Link
              href={"/pipeline-perpanjangan?branch=" + branch}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-hover"
            >
              Buka Pipeline →
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-10 gap-y-2 border-t border-white/15 pt-3">
            <div>
              <p className="text-[10px] text-slate-300">
                Estimasi nilai kontrak sebelumnya
              </p>
              <p className="mt-1 text-xl font-bold">
                {s.opportunity === null
                  ? "Belum ada data"
                  : formatRupiah(s.opportunity)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-300">
                Sertifikat klien dalam radar
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-300">
                {s.real_client_count} sertifikat
              </p>
            </div>
          </div>
        </Card>
      )}
      <nav
        aria-label="Modul monitoring"
        className={
          "grid gap-2 " +
          (domains.length > 2
            ? "sm:grid-cols-3"
            : domains.length > 1
              ? "sm:grid-cols-2"
              : "")
        }
      >
        {domains.map((d) => (
          <Link
            key={d}
            href={routes[d] + "?branch=" + branch}
            className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-3 text-xs font-semibold text-brand-navy hover:border-primary hover:bg-emerald-50"
          >
            <span>{MODULE_ACCESS[d].label}</span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>
      <ExpiringTable items={s.soon} branch={branch} today={todayWita()} />
    </div>
  );
}
