import Link from "next/link";
import { personnelText, processNotes } from "@/lib/personnel-text";
import { masterClient, type DataRow } from "@/features/master-data/server";
import { requireActiveUser } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { formatTimestamp } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { WorkflowDialog } from "./dialog";
import { REQUEST_STATUSES, RENEWAL_STATUSES } from "./model";
import { RenewalCompletionDialog } from "./renewal-completion-dialog";
import { CalibrationRequestPanel } from "./calibration-panel";
import { RenewalCleanupDialog } from "./renewal-cleanup-dialog";
import { RenewalSections } from "./renewal-sections";

export async function WorkflowPanel(props: {
  kind: "calibration" | "personnel";
  branch: string;
  row: DataRow;
}) {
  return props.kind === "calibration" ? (
    <CalibrationRequestPanel branch={props.branch} row={props.row} />
  ) : (
    <PersonnelRenewalPanel branch={props.branch} row={props.row} />
  );
}

async function PersonnelRenewalPanel({ branch, row }: { branch: string; row: DataRow }) {
  const { scopes } = await requireActiveUser();
  const db = await masterClient();
  const { data, error } = await db.from("personnel_renewal_cases").select("*")
    .eq("branch_code", branch).eq("certificate_id", row.id)
    .is("history_deleted_at", null).order("created_at", { ascending: false });
  if (error) throw Error("Proses perpanjangan belum dapat dimuat.");
  const records = (data || []) as DataRow[];
  const ids = records.map(r => r.id);
  const { data: events, error: eventError } = ids.length
    ? await db.from("personnel_renewal_events").select("*").in("case_id", ids).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (eventError) throw Error("Riwayat perpanjangan belum dapat dimuat.");
  const actorIds = [...new Set((events || []).map(event => String(event.actor_id)).filter(Boolean))];
  const { data: actors } = actorIds.length
    ? await db.from("profiles").select("id,full_name").eq("branch_code", branch).in("id", actorIds)
    : { data: [] };
  const actorNames = new Map((actors || []).map(actor => [String(actor.id), personnelText(actor.full_name)]));
  const hrga = hasPermission(scopes, branch, ["admin", "hrga"]);
  const lifetime = row.validity_kind === "lifetime";
  const superseded = !!row.superseded_by_certificate_id;
  const active = records.filter(r => !["cancelled", "renewed"].includes(String(r.status)));
  const finished = records.filter(r => ["cancelled", "renewed"].includes(String(r.status)));
  const status = String(active[0]?.status || row.renewal_status || "unprocessed");
  const canStart = hrga && !lifetime && !superseded && !active.length
    && !finished.some(record => record.status === "renewed")
    && (row.renewal_status !== "renewed" || ["Expired", "Kritis", "Perhatian", "Pantau"].includes(String(row.validity_status)));
  const labels: Record<string, string> = RENEWAL_STATUSES;
  return <Card className="mb-3 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-bold">Perpanjangan HRGA</h2>
      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
        {lifetime ? "Berlaku seumur hidup" : superseded ? "Sudah digantikan" : labels[status] || status}
      </span>
    </div>
    <RenewalSections count={(events || []).length} process={
      <div className="space-y-3">
        {active.map(r => <div key={String(r.id)} className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <strong className="text-sm">{labels[String(r.status)]}</strong>
              <p className="mt-1 text-[11px] text-muted-foreground">Diperbarui {formatTimestamp(String(r.updated_at))}</p>
            </div>
            {hrga && <WorkflowDialog kind="personnel" branch={branch} parent={String(row.id)} record={r}/>}
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-5">{processNotes(r.notes)}</p>
          {hrga && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-blue-100 pt-3">
            {r.status === "processing" && <RenewalCompletionDialog branch={branch} caseId={String(r.id)}
              version={Number(r.version)} title={String(row.original_title)} issuer={String(row.issuer || "")}/>}
            <RenewalCleanupDialog id={String(r.id)} branch={branch} version={Number(r.version)} status={String(r.status)}/>
          </div>}
        </div>)}
        {!active.length && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
          <p className="text-xs leading-5 text-muted-foreground">{lifetime ? "Tidak memerlukan perpanjangan berkala."
            : superseded ? "Sertifikat pengganti dapat dibuka dari tautan di atas."
            : row.renewal_status === "renewed" ? "Perpanjangan selesai. Sertifikat terbaru sudah tercatat."
            : "Belum ada proses perpanjangan yang berjalan."}</p>
          {canStart && <WorkflowDialog kind="personnel" branch={branch} parent={String(row.id)}/>}
        </div>}
        {hrga && active.some(r => r.status === "processing") && <p className="text-[11px] leading-5 text-muted-foreground">
          Setelah sertifikat terbit, pilih <strong>Catat sertifikat terbaru</strong>. Data, bukti, dan riwayat penyelesaian tersimpan sekaligus.
        </p>}
      </div>
    } history={
      <div className="space-y-3">
        {finished.map(r => <div key={String(r.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-xs">
          <div>
            <strong>{labels[String(r.status)]}</strong>
            <span className="ml-2 text-muted-foreground">{formatTimestamp(String(r.updated_at))}</span>
            {r.replacement_certificate_id ? <Link className="mt-1 block font-semibold text-primary-hover underline"
              href={"/kompetensi-personil/" + r.replacement_certificate_id + "?branch=" + branch}>Buka sertifikat terbaru ↗</Link> : null}
          </div>
          {hrga && <RenewalCleanupDialog id={String(r.id)} branch={branch} version={Number(r.version)} status={String(r.status)}/>}
        </div>)}
        {(events || []).length ? <ol className="space-y-3">
          {(events || []).map(event => <li key={String(event.id)} className="border-l-2 border-blue-200 pl-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <strong>{labels[String(event.new_status)] || "Catatan proses"}</strong>
              <time className="text-[11px] text-muted-foreground">{formatTimestamp(String(event.created_at))}</time>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words leading-5">{processNotes(event.notes)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{actorNames.get(String(event.actor_id)) || "Petugas berwenang"}</p>
          </li>)}
        </ol> : <p className="py-2 text-xs text-muted-foreground">Riwayat akan muncul setelah proses diperbarui.</p>}
      </div>
    }/>
  </Card>;
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
        ? "id,status,equipment_id,request_number,updated_at,quantity,portfolio_code_snapshot"
        : "id,status,certificate_id,updated_at",
    )
    .eq("branch_code", branch)
    .not(
      "status",
      "in",
      kind === "calibration" ? "(completed,cancelled)" : "(renewed,cancelled)",
    )
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) throw Error("Antrean proses belum dapat dimuat.");
  if (!data?.length) return null;
  const records = data as unknown as DataRow[];
  const { data: certificateData, error: certificateError } =
    kind === "personnel"
      ? await db
          .from("personnel_certificate_records")
          .select(
            "id,employee_name,original_title,certificate_type_name,certificate_number",
          )
          .eq("branch_code", branch)
          .in(
            "id",
            records.map((r) => String(r.certificate_id)),
          )
      : { data: [], error: null };
  if (certificateError)
    throw Error("Identitas pada antrean proses belum dapat dimuat.");
  const certificates = new Map(
    ((certificateData || []) as DataRow[]).map((certificate) => [
      String(certificate.id),
      certificate,
    ]),
  );
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
        {records.map((r) => {
          const certificate = certificates.get(String(r.certificate_id));
          return (
            <Link
              key={String(r.id)}
              className="valida-workflow-card rounded-lg border border-blue-200 bg-blue-50 p-3"
              href={
                (kind === "calibration"
                  ? "/kalibrasi-alat/" + r.equipment_id
                  : "/kompetensi-personil/" + r.certificate_id) +
                "?branch=" +
                branch
              }
            >
              {kind === "personnel" ? (
                <>
                  <strong className="block text-sm break-words text-brand-navy">
                    {String(
                      certificate?.employee_name ||
                        "Nama pegawai belum tersedia",
                    )}
                  </strong>
                  <span className="mt-1 block break-words">
                    {String(
                      certificate?.original_title ||
                        certificate?.certificate_type_name ||
                        "Nama lisensi belum tersedia",
                    )}
                  </span>
                  <span className="mt-1 block break-words text-muted-foreground">
                    No. sertifikat:{" "}
                    {String(certificate?.certificate_number || "Belum diisi")}
                  </span>
                  <span className="workflow-status mt-2 inline-block rounded-md bg-blue-100 px-2 py-1 font-medium text-blue-900">
                    {labels[String(r.status)]}
                  </span>
                </>
              ) : (
                <>
                  {String(r.request_number || "Permintaan kalibrasi")} ·{" "}
                  {labels[String(r.status)]}
                  {Number(r.quantity) > 1 && (
                    <span className="mt-1 block text-muted-foreground">
                      Bundel {String(r.quantity)} alat ·{" "}
                      {String(r.portfolio_code_snapshot || "")}
                    </span>
                  )}
                </>
              )}
              <span className="mt-1 block text-muted-foreground">
                {formatTimestamp(String(r.updated_at))}
              </span>
            </Link>
          );
        })}
      </div>
    </details>
  );
}
