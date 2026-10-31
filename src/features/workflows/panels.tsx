import Link from "next/link";
import { masterClient, type DataRow } from "@/features/master-data/server";
import { requireActiveUser } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { formatTimestamp } from "@/lib/format";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { Card } from "@/components/ui/card";
import { WorkflowDialog } from "./dialog";
import { REQUEST_STATUSES, RENEWAL_STATUSES } from "./model";
import { RenewalCompletionDialog } from "./renewal-completion-dialog";
import { CalibrationFormPreview } from "./form-preview";
import { resolveRequestIdentity } from "./request-identity";
import { CalibrationRequestPanel } from "./calibration-panel";

export async function WorkflowPanel(props: {
  kind: "calibration" | "personnel";
  branch: string;
  row: DataRow;
}) {
  return props.kind === "calibration" ? (
    <CalibrationRequestPanel branch={props.branch} row={props.row} />
  ) : (
    <LegacyWorkflowPanel {...props} />
  );
}
async function LegacyWorkflowPanel({
  kind,
  branch,
  row,
}: {
  kind: "calibration" | "personnel";
  branch: string;
  row: DataRow;
}) {
  const { scopes, profile } = await requireActiveUser(),
    db = await masterClient();
  const table =
      kind === "calibration"
        ? "calibration_requests"
        : "personnel_renewal_cases",
    parentField = kind === "calibration" ? "equipment_id" : "certificate_id";
  const { data, error } = await db
    .from(table)
    .select("*")
    .eq("branch_code", branch)
    .eq(parentField, row.id)
    .order("created_at", { ascending: false });
  if (error) throw Error("Riwayat proses belum dapat dimuat.");
  const records =
    kind === "calibration"
      ? await Promise.all(
          ((data || []) as DataRow[]).map((r) => resolveRequestIdentity(db, r)),
        )
      : ((data || []) as DataRow[]);
  const requester = hasPermission(scopes, branch, ["admin", "coordinator"]),
    ptk = hasPermission(scopes, branch, ["admin", "equipment_manager"]),
    hrga = hasPermission(scopes, branch, ["admin", "hrga"]);
  const [
    { data: supervisorData, error: supervisorError },
    { data: requesterIdentity },
  ] =
    kind === "calibration" && (requester || ptk)
      ? await Promise.all([
          db.rpc("calibration_request_supervisors", { b: branch }),
          profile.employee_id
            ? db
                .from("employee_directory_records")
                .select("full_name,npp")
                .eq("id", profile.employee_id)
                .eq("branch_code", branch)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ])
      : [{ data: [], error: null }, { data: null }];
  if (supervisorError)
    throw Error("Pilihan Kepala Bidang/Kepala UP belum dapat dimuat.");
  const supervisors = (supervisorData || []).map(
    (s: { id: string; full_name: string; role_code: string }) => ({
      id: s.id,
      label: `${s.full_name} · ${ROLE_LABELS[s.role_code as Role] || s.role_code}`,
    }),
  );
  const labels: Record<string, string> =
    kind === "calibration" ? REQUEST_STATUSES : RENEWAL_STATUSES;
  const ids = records.map((r) => r.id);
  const { data: history } = ids.length
    ? await db
        .from(
          kind === "calibration"
            ? "calibration_request_events"
            : "personnel_renewal_events",
        )
        .select("*")
        .in(kind === "calibration" ? "request_id" : "case_id", ids)
        .order("created_at", { ascending: false })
    : { data: [] };
  const { data: replacementData } =
    kind === "personnel" && hrga
      ? await db
          .from("personnel_certificates")
          .select("id,certificate_number,original_title,issue_date")
          .eq("employee_id", row.employee_id)
          .eq("certificate_type_id", row.certificate_type_id)
          .neq("id", row.id)
          .eq("is_active", true)
          .order("issue_date", { ascending: false })
          .limit(100)
      : { data: [] };
  const replacements = (replacementData || []).map((r) => ({
    id: String(r.id),
    label:
      String(r.certificate_number || r.original_title) +
      " · " +
      String(r.issue_date || "Tanggal belum diisi"),
  }));
  const { data: calibrationData } =
    kind === "calibration" && ptk && records.length
      ? await db
          .from("calibrations")
          .select("id,certificate_number,calibration_date,created_at")
          .eq("equipment_id", row.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(100)
      : { data: [] };
  const calibrationResults = (calibrationData || []).map((r) => ({
    id: String(r.id),
    label:
      String(r.certificate_number || "Nomor belum diisi") +
      " · " +
      String(r.calibration_date || "Tanggal belum diisi"),
  }));
  const lifetime = kind === "personnel" && row.validity_kind === "lifetime";
  return (
    <Card className="mb-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold">
          {kind === "calibration"
            ? "Permintaan Kalibrasi · FOR/SCI-UMA/197"
            : "Perpanjangan kompetensi · HRGA"}
        </h2>
        {!lifetime &&
          !(kind === "calibration"
            ? records.some(
                (r) => !["completed", "cancelled"].includes(String(r.status)),
              )
            : records.length > 0) &&
          (kind === "calibration" ? requester : hrga) && (
            <WorkflowDialog
              kind={kind}
              branch={branch}
              parent={String(row.id)}
              requester={requester}
              ptk={ptk}
              actorId={profile.id}
              supervisors={supervisors}
              initialValues={{
                ...row,
                tag: row.tag || row.asset_id,
                unit_name: row.unit,
                requester_name:
                  requesterIdentity?.full_name || profile.full_name,
                requester_npp: requesterIdentity?.npp,
              }}
            />
          )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {kind === "calibration"
          ? "Pengajuan tidak mengubah kelayakan alat. Alat expired tetap Tidak Layak Pakai sampai hasil kalibrasi baru dicatat."
          : lifetime
            ? "Sertifikat seumur hidup tidak masuk perpanjangan berkala."
            : "Belum Diproses → Sedang Diproses → Sudah Diperpanjang. Penyelesaian wajib menautkan sertifikat pengganti beserta bukti."}
      </p>
      {kind === "personnel" && !lifetime && (
        <ol
          aria-label="Tahap perpanjangan sertifikat"
          className="mt-3 flex flex-wrap gap-2 text-xs"
        >
          {Object.entries(RENEWAL_STATUSES).map(([stage, label]) => (
            <li
              key={stage}
              className={
                "rounded-full border px-3 py-1 " +
                ((records[0]?.status || "unprocessed") === stage
                  ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-900"
                  : "border-border text-muted-foreground")
              }
            >
              {label}
            </li>
          ))}
        </ol>
      )}
      {!records.length && !lifetime && (
        <p className="mt-3 text-xs">
          {kind === "calibration"
            ? "Belum ada permintaan."
            : "Belum Diproses — HRGA belum membuka proses perpanjangan."}
        </p>
      )}
      {records.map((r) => (
        <div
          key={String(r.id)}
          className="mt-3 rounded-lg border border-border p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-xs">
              {String(r.request_number || "Proses perpanjangan")} ·{" "}
              {labels[String(r.status)]}
            </strong>
            {!["completed", "cancelled", "renewed"].includes(
              String(r.status),
            ) &&
              (kind === "calibration"
                ? (requester &&
                    ["draft", "awaiting_signatures", "correction"].includes(
                      String(r.status),
                    )) ||
                  (ptk && ["submitted", "accepted"].includes(String(r.status)))
                : hrga) && (
                <WorkflowDialog
                  kind={kind}
                  branch={branch}
                  parent={String(row.id)}
                  record={r}
                  requester={requester}
                  ptk={ptk}
                  actorId={profile.id}
                  supervisors={supervisors}
                  replacements={replacements}
                  calibrationResults={calibrationResults}
                />
              )}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-xs">{String(r.notes)}</p>
          {kind === "calibration" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <CalibrationFormPreview
                id={String(r.id)}
                version={Number(r.version)}
              />
            </div>
          )}
          {kind === "personnel" && hrga && r.status === "processing" && (
            <div className="mt-3">
              <RenewalCompletionDialog
                branch={branch}
                caseId={String(r.id)}
                version={Number(r.version)}
                title={String(row.original_title)}
                issuer={String(row.issuer || "")}
              />
            </div>
          )}
          {r.signed_document_id ? (
            <a
              href={"/api/workflows/documents?id=" + r.signed_document_id}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs underline"
            >
              PDF pengajuan bertanda tangan
            </a>
          ) : null}
          {r.replacement_certificate_id ? (
            <Link
              className="mt-2 block text-xs underline"
              href={
                "/kompetensi-personil/" +
                r.replacement_certificate_id +
                "?branch=" +
                branch
              }
            >
              Buka sertifikat pengganti
            </Link>
          ) : null}
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer font-semibold">
              Log proses
            </summary>
            <ol className="mt-2 space-y-2">
              {(history || [])
                .filter(
                  (h) =>
                    h[kind === "calibration" ? "request_id" : "case_id"] ===
                    r.id,
                )
                .map((h) => (
                  <li key={h.id} className="border-l-2 border-border pl-3">
                    <strong>{labels[h.new_status]}</strong> ·{" "}
                    {formatTimestamp(h.created_at)}
                    <span className="block text-[10px] text-muted-foreground">
                      Aktor: {h.actor_id}
                    </span>
                    <p>{h.notes}</p>
                    {kind === "personnel" && !h.holder_delivery_available && (
                      <p className="text-amber-800">
                        Notifikasi pemilik belum dapat dikirim: akun aktif belum
                        ditautkan ke identitas pegawai. Administrator perlu
                        menautkan akun.
                      </p>
                    )}
                  </li>
                ))}
            </ol>
          </details>
        </div>
      ))}
    </Card>
  );
}
export async function WorkflowOverview({
  kind,
  branch,
}: {
  kind: "calibration" | "personnel";
  branch: string;
}) {
  const db = await masterClient();
  const { data, error } = await db
    .from(
      kind === "calibration"
        ? "calibration_requests"
        : "personnel_renewal_cases",
    )
    .select(
      kind === "calibration"
        ? "id,status,equipment_id,request_number,updated_at"
        : "id,status,certificate_id,updated_at",
    )
    .eq("branch_code", branch)
    .not(
      "status",
      "in",
      kind === "calibration" ? "(completed,cancelled)" : "(renewed)",
    )
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) throw Error("Antrean proses belum dapat dimuat.");
  if (!data?.length) return null;
  const labels: Record<string, string> =
    kind === "calibration" ? REQUEST_STATUSES : RENEWAL_STATUSES;
  return (
    <details className="mb-4 rounded-xl border border-border bg-white p-3 text-xs">
      <summary className="cursor-pointer font-semibold">
        {kind === "calibration"
          ? "Permintaan kalibrasi aktif"
          : "Proses perpanjangan HRGA"}{" "}
        · {data.length}
        {data.length === 30 ? " teratas" : ""}
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(data as unknown as DataRow[]).map((r) => (
          <Link
            key={String(r.id)}
            className="rounded-lg border border-border p-3 hover:bg-slate-50"
            href={
              (kind === "calibration"
                ? "/kalibrasi-alat/" + r.equipment_id
                : "/kompetensi-personil/" + r.certificate_id) +
              "?branch=" +
              branch
            }
          >
            {String(r.request_number || "Proses kompetensi")} ·{" "}
            {labels[String(r.status)]}
            <span className="mt-1 block text-muted-foreground">
              {formatTimestamp(String(r.updated_at))}
            </span>
          </Link>
        ))}
      </div>
    </details>
  );
}
