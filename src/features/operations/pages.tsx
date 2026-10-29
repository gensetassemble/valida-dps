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
  masterClient,
  type QueryParams,
  type DataRow,
} from "@/features/master-data/server";
import { hasPermission } from "@/lib/auth/permissions";
import { formatBusinessDate, formatRupiah } from "@/lib/format";
import { driveFolder, validityLabel } from "@/lib/domain/validity";
import { OperationalForm, CorrectionForm, EvidenceForm } from "./forms";
import { OperationalFilters } from "./filters";
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
        {c.canWrite && (
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
        description="Identitas induk tetap dipertahankan. Pilih Terverifikasi hanya setelah bukti diperiksa."
      />
      <Card className="max-w-4xl p-5">
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
  const db = await masterClient();
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
        <StatusBadge value={String(row.verification_status)} />
        {c.canWrite && (
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
          .filter((f) => !["is_active", "verification_status"].includes(f.key))
          .map((f) => (
            <div key={f.key}>
              <p className="text-[11px] text-muted-foreground">{f.label}</p>
              <p className="mt-1 break-words text-sm">
                {f.kind === "money"
                  ? formatRupiah(String(row[f.key] ?? ""))
                  : f.kind === "date"
                    ? formatBusinessDate(row[f.key] as string | null)
                    : f.options?.find((o) => o.value === row[f.key])?.label ||
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
                {formatBusinessDate(value as string | null)}
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
              {formatBusinessDate(h.expiry_date as string)}
            </Link>
          ))}
        </Card>
      )}
      {entity === "kalibrasi-alat" && (
        <>
          <div className="mb-4 flex gap-3">
            {c.canWrite && (
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
              Folder adalah referensi sumber dan tidak membuktikan dokumen telah
              diverifikasi.
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
          {c.canWrite && (
            <EvidenceForm domain={domain} id={id} branch={c.branch} />
          )}
        </Card>
      )}
    </>
  );
}
