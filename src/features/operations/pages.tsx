import { AccessDenied } from "@/components/ui/access-denied";
import Link from "next/link";
import { notFound } from "next/navigation";
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
import { OperationalForm, CorrectionForm, EvidenceForm } from "./forms";
import { OperationalFilters } from "./filters";
import { monitoringColumns } from "./monitoring";
import { businessNotes } from "./notes";
import { WorkflowPanel, WorkflowOverview } from "@/features/workflows/panels";
export async function OperationList({
  entity,
  params,
}: {
  entity: string;
  params: QueryParams;
}) {
  const c = await pageEntityContext(entity, params.branch);
  if (!c) return <AccessDenied />;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {c.canWrite &&
          !["kompetensi-personil", "kalibrasi-alat"].includes(entity) && (
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
        <Button asChild variant="outline">
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
        </Button>
      </div>
      <OperationalFilters entity={entity} branch={c.branch} params={params} />
      {["kalibrasi-alat", "kompetensi-personil"].includes(entity) && (
        <WorkflowOverview
          kind={entity === "kalibrasi-alat" ? "calibration" : "personnel"}
          branch={c.branch}
        />
      )}
      <MasterPage entity={entity} params={params} />
    </>
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
  if (id && !row) notFound();
  if (parent) {
    const parentEntity =
      entity === "riwayat-kalibrasi" ? "kalibrasi-alat" : null;
    if (parentEntity) {
      const p = await entityContext(parentEntity, c.branch);
      if (!(await getRecord(p.entity, c.branch, parent.id))) notFound();
    }
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
  if (!row) notFound();
  const canEditRow =
    c.canWrite &&
    (entity !== "sertifikat-klien" ||
      hasPermission(c.scopes, c.branch, ["admin"]) ||
      row.account_manager_id === c.user.id);
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
        : entity === "riwayat-kalibrasi"
          ? "calibration"
          : null;
  const { data: documents } = domain
    ? await db
        .from("operational_documents")
        .select("id,kind,original_name")
        .eq("domain", domain)
        .eq("record_id", id)
    : { data: [] };
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
        <Card className="mb-5 grid gap-4 p-5 sm:grid-cols-3">
          {[
            [
              "Account Manager (AM)",
              row.account_manager_name || "Belum ditugaskan",
            ],
            ["Wilayah", row.work_area_name || "Belum dipetakan"],
            ["Cabang operasional", row.branch_code],
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
      <Card className="mb-5 grid gap-4 p-5 sm:grid-cols-2">
        {c.entity.fields
          .filter(
            (f) =>
              !["is_active", "verification_status"].includes(f.key) &&
              (f.key !== "notes" || !!businessNotes(row.notes)),
          )
          .map((f) => (
            <div key={f.key}>
              <p className="text-[11px] text-muted-foreground">{f.label}</p>
              <p className="mt-1 break-words text-sm">
                {f.key === "notes" ? (
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
              </p>
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
          <h2 className="text-sm font-bold">Dokumen privat</h2>
          {documents?.length ? (
            documents.map((d) => (
              <a
                key={String(d.id)}
                className="mt-2 block text-xs underline"
                target="_blank"
                rel="noopener noreferrer"
                href={"/api/documents?id=" + d.id}
              >
                {String(d.original_name)} · {String(d.kind)}
              </a>
            ))
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Belum ada dokumen PDF yang diberikan.
            </p>
          )}
          {canEditRow && (
            <EvidenceForm domain={domain} id={id} branch={c.branch} />
          )}
        </Card>
      )}
    </>
  );
}
