import { AccessDenied } from "@/components/ui/access-denied";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { MasterPage, MasterTable } from "@/features/master-data/pages";
import {
  entityContext,
  pageEntityContext,
  getRecord,
  referenceLabels,
  masterClient,
  type QueryParams,
  type DataRow,
} from "@/features/master-data/server";
import { hasPermission } from "@/lib/auth/permissions";
import { DeadlineDate } from "@/components/ui/deadline-date";
import { formatBusinessDate, formatRupiah } from "@/lib/format";
import { driveFolder, validityLabel, todayWita } from "@/lib/domain/validity";
import { OperationalForm, CorrectionForm } from "./forms";
import { CertificateDocuments } from "./certificate-documents";
import { OperationalFilters } from "./filters";
import { monitoringColumns } from "./monitoring";
import { businessNotes } from "./notes";
import { WorkflowPanel, WorkflowOverview } from "@/features/workflows/panels";
import { EquipmentRequestForm } from "@/features/workflows/calibration-controls";
import { RenewalEmailPreview } from "./renewal-email-preview";
import { EquipmentExportMenu } from "./equipment-export-menu";
import { MeasurementSummary } from "./measurement-summary";
export async function OperationList({
  entity,
  params,
}: {
  entity: string;
  params: QueryParams;
}) {
  const c = await pageEntityContext(entity, params.branch);
  if (!c) return <AccessDenied />;
  const exportOptions: { id: string; code: string; count: number }[] = [];
  let exportUnavailable = false;
  if (entity === "kalibrasi-alat") {
    const db = await masterClient();
    const { data, error } = await db.from("equipment_monitoring_records")
      .select("portfolio_id,portfolio_code").eq("branch_code", c.branch).limit(10000);
    exportUnavailable = !!error;
    const grouped = new Map<string, { id: string; code: string; count: number }>();
    for (const row of data || []) if (row.portfolio_id && row.portfolio_code) {
      const option = grouped.get(String(row.portfolio_id)) || { id: String(row.portfolio_id), code: String(row.portfolio_code), count: 0 };
      option.count++; grouped.set(option.id, option);
    }
    exportOptions.push(...[...grouped.values()].sort((a,b) => a.code.localeCompare(b.code)));
  }
  const compact = ["sertifikat-klien", "kompetensi-personil", "kalibrasi-alat"].includes(entity);
  return (
    <>
      <div className={compact ? "mb-3 flex flex-wrap items-end justify-between gap-3" : ""}>
        {compact && <header>
          <h1 className="text-2xl font-bold tracking-tight text-brand-navy">{c.entity.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{entity === "kalibrasi-alat" ? "Monitoring alat internal per portofolio." : entity === "sertifikat-klien" ? "Arsip bertahap · PIC [UJI] untuk pengujian internal." : "Pantau masa berlaku dan tindak lanjut sertifikat."}</p>
        </header>}
      <div className={compact ? "flex flex-wrap items-center gap-2" : "mb-4 flex flex-wrap items-center gap-3"}>
        {entity === "kalibrasi-alat" &&
          c.scopes.some(
            (s) => s.branch_code === c.branch && s.role_code === "coordinator",
          ) && <EquipmentRequestForm branch={c.branch} />}
        {c.canWrite &&
          !["kompetensi-personil", "kalibrasi-alat", "sertifikat-klien"].includes(entity) && (
            <Button asChild>
              <Link href={"/" + entity + "/baru?branch=" + c.branch}>
                Tambah rekaman
              </Link>
            </Button>
          )}
        {entity === "kompetensi-personil" && (
          <Button asChild variant="outline">
            <Link href={"/kompetensi-personil/matriks?branch=" + c.branch}>
              Matriks Kompetensi
            </Link>
          </Button>
        )}
        {entity === "kalibrasi-alat" ? <EquipmentExportMenu key={c.branch} branch={c.branch} portfolios={exportOptions} unavailable={exportUnavailable}/> : <Button asChild variant="outline">
          <a
            href={
              "/api/operations/export?" +
              new URLSearchParams({
                ...params,
                entity,
                branch: c.branch,
              } as Record<string, string>)
            }
          >
            Ekspor XLSX sesuai filter
          </a>
        </Button>}
        {entity === "kompetensi-personil" && (
          <Button asChild variant="outline">
            <a
              href={
                "/api/operations/export?" +
                new URLSearchParams({
                  ...params,
                  entity,
                  branch: c.branch,
                  include_inactive: "true",
                } as Record<string, string>)
              }
            >
              Ekspor termasuk personil nonaktif
            </a>
          </Button>
        )}
        {entity === "sertifikat-klien" && <nav aria-label="Versi sertifikat klien" className="flex flex-wrap gap-2 text-xs">
          <Link className="rounded-lg border border-border bg-white px-3 py-2" href={`?branch=${c.branch}`}>Sertifikat terkini</Link>
          <Link className="rounded-lg border border-border bg-white px-3 py-2" href={`?branch=${c.branch}&generation=all`}>Semua versi / arsip</Link>
        </nav>}
      </div>
      </div>
      {entity === "kalibrasi-alat" && <WorkflowOverview kind="calibration" branch={c.branch}/>}
      {entity === "kompetensi-personil" && (
        <WorkflowOverview
          kind="personnel"
          branch={c.branch}
        />
      )}
      <OperationalFilters entity={entity} branch={c.branch} params={params} />
      {compact ? <MasterTable entity={entity} params={params} /> : <MasterPage entity={entity} params={params} />}
    </>
  );
}
async function redirectResetCertificate(
  entity: string,
  branch: string,
  id: string,
) {
  if (entity !== "kompetensi-personil") return;
  const db = await masterClient();
  const { data, error } = await db
    .from("personnel_renewal_cases")
    .select("certificate_id")
    .eq("replacement_certificate_id", id)
    .eq("branch_code", branch)
    .eq("status", "renewed")
    .not("history_deleted_at", "is", null)
    .maybeSingle();
  if (error) throw Error("Referensi reset sertifikat belum dapat dimuat.");
  if (data)
    redirect(
      `/kompetensi-personil/${data.certificate_id}?branch=${encodeURIComponent(branch)}`,
    );
}

export async function OperationEditor({
  entity,
  id,
  params,
  parent,
}: {
  entity: string;
  id?: string;
  params: QueryParams;
  parent?: { field: string; id: string };
}) {
  const c = await pageEntityContext(entity, params.branch, true);
  if (!c) return <AccessDenied />;
  const row = id ? await getRecord(c.entity, c.branch, id) : undefined;
  let measurementDefaults: DataRow | undefined;
  if (id && !row) {
    await redirectResetCertificate(entity, c.branch, id);
    notFound();
  }
  if (parent) {
    const parentEntity =
      entity === "riwayat-kalibrasi" ? "kalibrasi-alat" : null;
    if (parentEntity) {
      const p = await entityContext(parentEntity, c.branch);
      const equipment = await getRecord(p.entity, c.branch, parent.id);
      if (!equipment) notFound();
      measurementDefaults = equipment;
    }
  }
  if (
    !measurementDefaults &&
    entity === "riwayat-kalibrasi" &&
    row?.equipment_id
  ) {
    const p = await entityContext("kalibrasi-alat", c.branch);
    measurementDefaults =
      (await getRecord(p.entity, c.branch, String(row.equipment_id))) ||
      undefined;
  }
  return (
    <>
      <PageHeader
        title={(id ? "Ubah " : "Tambah ") + c.entity.singular}
        description="Identitas induk tetap dipertahankan. Masa berlaku langsung dihitung dari tanggal yang dicatat."
      />
      <Card className="w-full p-5">
        <OperationalForm
          entity={c.entity}
          row={row || undefined}
          measurementDefaults={measurementDefaults}
          branch={c.branch}
          userId={c.user.id}
          isAdmin={hasPermission(c.scopes, c.branch, ["admin"])}
          parent={parent}
        />
      </Card>
    </>
  );
}
export async function OperationDetail({
  entity,
  id,
  params,
}: {
  entity: string;
  id: string;
  params: QueryParams;
}) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const c = await pageEntityContext(entity, params.branch);
  if (!c) return <AccessDenied />;
  const row = await getRecord(c.entity, c.branch, id);
  if (!row) {
    await redirectResetCertificate(entity, c.branch, id);
    notFound();
  }
  const canEditRow = c.canWrite;
  const labels = await referenceLabels(c.entity, c.branch, row);
  const db = await masterClient();
  if (
    entity === "kalibrasi-alat" &&
    !row.responsible_employee_id &&
    row.portfolio_id
  ) {
    const today = todayWita();
    const { data } = await db
      .from("portfolio_coordinators")
      .select("coordinator:operational_coordinators(full_name,is_active)")
      .eq("branch_code", c.branch)
      .eq("portfolio_id", row.portfolio_id)
      .eq("is_active", true)
      .lte("effective_from", today)
      .or("effective_until.is.null,effective_until.gte." + today)
      .maybeSingle();
    const coordinator = data?.coordinator as unknown as {
      full_name: string;
      is_active: boolean;
    } | null;
    if (coordinator?.is_active)
      labels.responsible_employee_id =
        coordinator.full_name + " (koordinator portofolio saat ini)";
  }
  const domain =
    entity === "sertifikat-klien"
      ? "client"
      : entity === "kompetensi-personil"
        ? "personnel"
        : entity === "riwayat-kalibrasi" || (entity === "kalibrasi-alat" && row.latest_calibration_id)
          ? "calibration"
          : null;
  const documentRecordId = entity === "kalibrasi-alat" ? String(row.latest_calibration_id) : id;
  const { data: documents, error: documentError } = domain
    ? await db
        .from("operational_documents")
        .select("id,kind,original_name")
        .eq("domain", domain)
        .eq("record_id", documentRecordId)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  const sourceFolder = driveFolder(row.source_folder_url as string | null);
  let history: DataRow[] = [];
  if (entity === "sertifikat-klien") {
    const q = await db
      .from("client_certificate_records")
      .select("id,certificate_number,issue_date,expiry_date")
      .eq("previous_certificate_id", id)
      .limit(50);
    history = (q.data || []) as DataRow[];
  }
  return (
    <>
      <Link
        className="text-xs font-semibold text-primary-hover underline"
        href={c.entity.path + "?branch=" + c.branch}
      >
        ← Kembali
      </Link>
      <PageHeader
        title={String(row[c.entity.labelKey] || c.entity.singular)}
        description={c.entity.description}
      />
      {row.is_example === true && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          [CONTOH] Data dummy development. Dikecualikan dari peluang
          perpanjangan riil.
        </p>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        {entity === "sertifikat-klien" && canEditRow && row.is_active === true && row.is_example !== true && <RenewalEmailPreview certificate={id} branch={c.branch}/>}
        {row.validity_status ? (
          <StatusBadge
            value={
              row.validity_kind === "lifetime"
                ? validityLabel(
                    row.expiry_date as string | null,
                    row.verification_status === "verified",
                    true,
                  )
                : String(row.validity_status)
            }
          />
        ) : null}
        {row.eligibility_status ? (
          <StatusBadge value={String(row.eligibility_status)} />
        ) : null}
        {canEditRow && (
          <Button asChild variant="outline" size="sm">
            <Link
              href={
                (entity === "riwayat-kalibrasi"
                  ? "/peristiwa-kalibrasi"
                  : c.entity.path) +
                "/" +
                id +
                "/ubah?branch=" +
                c.branch
              }
            >
              Ubah rekaman
            </Link>
          </Button>
        )}
      </div>
      {Array.isArray(row.monitoring_measurements) &&
        row.monitoring_measurements.length > 1 && (
          <Card className="mb-4 overflow-x-auto p-4">
            <h2 className="mb-2 text-sm font-bold">
              Rincian parameter kalibrasi dari Excel
            </h2>
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  {[
                    "Parameter",
                    "Range / Kapasitas",
                    "Faktor Koreksi",
                    "Internal",
                    "Eksternal",
                    "Signifikan — Ya",
                    "Signifikan — Tidak",
                  ].map((label) => (
                    <th className="border-b p-2" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {row.monitoring_measurements.map((m, index) => (
                  <tr key={index}>
                    {[
                      String(index + 1),
                      ...monitoringColumns
                        .filter(([key]) =>
                          [
                            "measurement_range",
                            "correction_factor",
                            "calibration_internal",
                            "calibration_external",
                            "significant_yes",
                            "significant_no",
                          ].includes(key),
                        )
                        .sort(
                          (a, b) =>
                            [
                              "measurement_range",
                              "correction_factor",
                              "calibration_internal",
                              "calibration_external",
                              "significant_yes",
                              "significant_no",
                            ].indexOf(a[0]) -
                            [
                              "measurement_range",
                              "correction_factor",
                              "calibration_internal",
                              "calibration_external",
                              "significant_yes",
                              "significant_no",
                            ].indexOf(b[0]),
                        )
                        .map(([key]) => String((m as DataRow)[key] ?? "—")),
                    ].map((v, col) => (
                      <td
                        className="border-b p-2 align-top whitespace-pre-wrap"
                        key={col}
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      {entity === "sertifikat-klien" && (
        <Card className="valida-detail-grid mb-5 grid gap-4 p-5 sm:grid-cols-3">
          {[
            [
              "Account Manager (AM)",
              row.account_manager_name || "Belum ditugaskan",
            ],
            ["Wilayah", row.work_area_name || "Belum dipetakan"],
            ["Cabang operasional", row.branch_code],
            ["PIC perusahaan", row.pic_name || "Belum diisi"],
            ["Email PIC", row.pic_email || "Belum diisi"],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <p className="text-[11px] text-muted-foreground">
                {String(label)}
              </p>
              <strong className="mt-1 block text-sm">{String(value)}</strong>
            </div>
          ))}
        </Card>
      )}
      <Card className="valida-detail-grid mb-5 grid gap-4 p-5 sm:grid-cols-2">
        {c.entity.fields
          .filter(
            (f) =>
              !["is_active", "verification_status"].includes(f.key) &&
              !(entity === "sertifikat-klien" && f.key === "interval_days") &&
              (f.key !== "notes" || !!businessNotes(row.notes)),
          )
          .map((f) => (
            <div key={f.key}>
              <p className="text-[11px] text-muted-foreground">{f.label}</p>
              <div className="mt-1 min-w-0 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
                {f.key === "measurement_range" || f.key === "correction_factor" ? (
                  <MeasurementSummary row={row} field={f.key} assetRanges={entity === "kalibrasi-alat" && f.key === "measurement_range"}/>
                ) : entity === "sertifikat-klien" && f.key === "interval_months" ? (
                  String(row.interval_label || "—")
                ) : f.key === "notes" ? (
                  businessNotes(row.notes)
                ) : f.kind === "lookup" ? (
                  labels[f.key] || "—"
                ) : f.kind === "money" ? (
                  formatRupiah(String(row[f.key] ?? ""))
                ) : f.kind === "date" ? (
                  /(?:expiry|due|valid_until|end_date)/.test(f.key) ? (
                    <DeadlineDate value={row[f.key]} />
                  ) : (
                    formatBusinessDate(row[f.key] as string | null)
                  )
                ) : (
                  f.options?.find((o) => o.value === row[f.key])?.label ||
                  String(
                    (
                      {
                        client_id: row.client_name,
                        employee_id: row.employee_name,
                        certificate_type_id: row.certificate_type_name,
                        equipment_id: row.equipment_name,
                      } as Record<string, unknown>
                    )[f.key] ||
                      row[f.key] ||
                      "—",
                  )
                )}
              </div>
            </div>
          ))}
      </Card>
      {entity === "riwayat-kalibrasi" && (
        <Card className="mb-5 grid gap-4 p-5 sm:grid-cols-3">
          {[
            ["Tanggal akhir pada dokumen", row.reported_due_date],
            ["Hasil perhitungan kalender", row.calculated_due_date],
            ["Tanggal akhir yang digunakan", row.due_date],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <p className="text-[11px] text-muted-foreground">
                {String(label)}
              </p>
              <strong className="mt-1 block text-sm">
                {<DeadlineDate value={value} />}
              </strong>
            </div>
          ))}
        </Card>
      )}
      {entity === "sertifikat-klien" && (
        <Card className="mb-5 p-5">
          <h2 className="text-sm font-bold">
            Generasi sertifikat terkait secara eksplisit
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Riwayat mengikuti relasi generasi yang dipilih; serial sama/kosong
            tidak otomatis menggabungkan objek.
          </p>
          {row.previous_certificate_id ? (
            <Link
              className="mt-3 block text-xs underline"
              href={
                "/sertifikat-klien/" +
                row.previous_certificate_id +
                "?branch=" +
                c.branch
              }
            >
              Buka generasi sebelumnya
            </Link>
          ) : (
            <p className="mt-3 text-xs">
              Belum ada generasi sebelumnya yang ditautkan.
            </p>
          )}
          {history.map((h) => (
            <Link
              key={String(h.id)}
              className="mt-2 block text-xs underline"
              href={"/sertifikat-klien/" + h.id + "?branch=" + c.branch}
            >
              {String(h.certificate_number || "Generasi berikutnya")} ·{" "}
              {<DeadlineDate value={h.expiry_date} />}
            </Link>
          ))}
        </Card>
      )}
      {entity === "kalibrasi-alat" && (
        <>
          <WorkflowPanel kind="calibration" branch={c.branch} row={row} />
          <div className="mb-4 flex gap-3">
            {canEditRow && (
              <Button asChild>
                <Link
                  href={
                    "/kalibrasi-alat/" +
                    id +
                    "/kalibrasi/baru?branch=" +
                    c.branch
                  }
                >
                  Tambah peristiwa kalibrasi
                </Link>
              </Button>
            )}
          </div>
          <MasterTable
            entity="riwayat-kalibrasi"
            params={{ branch: c.branch, sort: "calibration_date", dir: "desc" }}
            parent={{ field: "equipment_id", id }}
          />
        </>
      )}
      {entity === "kompetensi-personil" && (
        <>
          {!!(
            row.previous_certificate_id || row.superseded_by_certificate_id
          ) && (
            <Card className="mb-4 space-y-2 p-4 text-sm">
              <p>
                {row.superseded_by_certificate_id
                  ? "Riwayat: sertifikat ini sudah digantikan."
                  : "Sertifikat terbaru hasil perpanjangan."}
              </p>
              {!!row.superseded_by_certificate_id && (
                <Link
                  className="block underline"
                  href={`/kompetensi-personil/${row.superseded_by_certificate_id}?branch=${c.branch}`}
                >
                  Buka sertifikat pengganti
                </Link>
              )}
              {!!row.previous_certificate_id && (
                <Link
                  className="block underline"
                  href={`/kompetensi-personil/${row.previous_certificate_id}?branch=${c.branch}`}
                >
                  Lihat riwayat sertifikat sebelumnya
                </Link>
              )}
            </Card>
          )}
          <WorkflowPanel kind="personnel" branch={c.branch} row={row} />
          <Card className="mb-5 p-5">
            <h2 className="text-sm font-bold">Sumber dan usulan koreksi</h2>
            {sourceFolder ? (
              <a
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block text-sm text-primary-hover underline"
                href={sourceFolder}
              >
                Buka Folder Sertifikat
              </a>
            ) : (
              <p className="mt-2 text-xs">
                Belum ada referensi folder. Hak akses Google Drive ditetapkan
                pemilik folder.
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Folder merupakan referensi arsip. Hak akses dokumen mengikuti
              pengaturan pemilik folder.
            </p>
            {(hasPermission(c.scopes, c.branch, ["admin", "hrga"]) ||
              (hasPermission(c.scopes, c.branch, ["inspector"]) &&
                c.profile.employee_id === row.employee_id)) && (
              <CorrectionForm id={id} branch={c.branch} />
            )}
          </Card>
          <MasterTable
            entity="kompetensi-personil"
            params={{ branch: c.branch }}
            parent={{ field: "employee_id", id: String(row.employee_id) }}
          />
        </>
      )}
      {domain && (
        <Card className="mt-5 p-5">
          {entity === "kalibrasi-alat" && <p className="mb-3 text-xs text-muted-foreground">Lampiran untuk hasil kalibrasi terbaru. Lampiran hasil sebelumnya tersedia di Riwayat Kalibrasi.</p>}
          {documentError ? <p role="alert" className="text-sm text-red-800">Daftar lampiran belum dapat dimuat. Gunakan Refresh untuk mencoba kembali.</p> :
            <CertificateDocuments documents={documents || []} domain={domain} id={documentRecordId} branch={c.branch} canWrite={canEditRow} />}
        </Card>
      )}
    </>
  );
}
