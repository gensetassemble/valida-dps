"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { saveWorkflow } from "./actions";
import { CalibrationFormPreview } from "./form-preview";
import { formatBusinessDate } from "@/lib/format";
import { draftBusinessDate } from "./request-form-model";
import {
  REQUEST_STATUSES,
  RENEWAL_STATUSES,
  requestTransitions,
  renewalTransitions,
} from "./model";
type Row = Record<string, unknown>;
export function WorkflowDialog({
  kind,
  branch,
  parent,
  record,
  requester = false,
  ptk = false,
  replacements = [],
  calibrationResults = [],
  initialValues = {},
  supervisors = [],
  actorId,
}: {
  kind: "calibration" | "personnel";
  branch: string;
  parent: string;
  record?: Row;
  requester?: boolean;
  ptk?: boolean;
  replacements?: { id: string; label: string }[];
  calibrationResults?: { id: string; label: string }[];
  initialValues?: Row;
  supervisors?: { id: string; label: string }[];
  actorId?: string;
}) {
  const [open, setOpen] = useState(false),
    [current, setCurrent] = useState<Row | undefined>(record),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [document, setDocument] = useState("");
  const [dirty, setDirty] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const router = useRouter();
  const status = String(
    current?.status || (kind === "calibration" ? "draft" : "unprocessed"),
  );
  const transitions = !current
    ? []
    : kind === "calibration"
      ? requestTransitions(status, requester, ptk)
      : renewalTransitions(status);
  const canEdit =
    kind === "calibration" &&
    requester &&
    ["draft", "awaiting_signatures", "correction"].includes(status);
  const canEstimate =
    kind === "calibration" &&
    ptk &&
    !!current &&
    actorId !== current.created_by &&
    ["submitted", "accepted"].includes(status);
  const labels: Record<string, string> =
    kind === "calibration" ? REQUEST_STATUSES : RENEWAL_STATUSES;
  async function save(form: HTMLFormElement) {
    setBusy(true);
    setError("");
    try {
      const f = new FormData(form),
        text = (k: string) => String(f.get(k) || "").trim() || null;
      const payload =
        kind === "personnel"
          ? {
              certificate_id: parent,
              status: text("status"),
              replacement_certificate_id: text("replacement_certificate_id"),
              notes: text("notes"),
            }
          : {
              equipment_id: parent,
              status: text("status"),
              request_number: text("request_number"),
              unit_name: text("unit_name"),
              quantity: Number(f.get("quantity") || 1),
              laboratory: text("laboratory"),
              resolution_class: text("resolution_class"),
              ...(canEstimate
                ? {
                    estimated_days:
                      text("estimated_days") === null
                        ? null
                        : Number(f.get("estimated_days")),
                    estimated_cost:
                      text("estimated_cost") === null
                        ? null
                        : Number(f.get("estimated_cost")),
                  }
                : {}),
              supervisor_profile_id: text("supervisor_profile_id"),
              requester_signed: f.get("requester_signed") === "on",
              supervisor_signed: f.get("supervisor_signed") === "on",
              signed_document_id:
                document || current?.signed_document_id || null,
              calibration_id: text("calibration_id"),
              notes: text("notes"),
            };
      const result = await saveWorkflow(
        kind,
        branch,
        current ? String(current.id) : null,
        current ? Number(current.version) : null,
        payload,
      );
      if (result.error) setError(result.error);
      else if (result.record) {
        setCurrent(result.record);
        setDirty(false);
        setSavedMessage(
          "Draf tersimpan. Preview dan PDF sudah mengikuti isian ini.",
        );
        router.refresh();
        if (current && kind !== "calibration") setOpen(false);
      }
    } catch {
      setError("Proses belum tersimpan. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      const f = new FormData();
      f.set("file", file);
      f.set("request", String(current.id));
      f.set("branch", branch);
      const r = await fetch("/api/workflows/documents", {
        method: "POST",
        body: f,
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setDocument(d.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unggah ditolak.");
    } finally {
      setBusy(false);
    }
  }
  const inputClass =
    "h-9 w-full rounded-md border border-input bg-white px-2 text-sm read-only:bg-slate-50 read-only:text-muted-foreground disabled:bg-slate-50";
  function field(key: string, label: string, type = "text") {
    return (
      <label className="grid gap-1 text-xs" key={key}>
        {label}
        <input
          type={type}
          name={key}
          defaultValue={String(
            current?.[key] ??
              initialValues[key] ??
              (key === "quantity" ? 1 : ""),
          )}
          className={inputClass}
          maxLength={200}
          min={type === "number" ? 0 : undefined}
          readOnly={
            key.startsWith("estimated_")
              ? !canEstimate
              : !!current && !canEdit && kind === "calibration"
          }
        />
      </label>
    );
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setCurrent(record);
          setDocument("");
          setError("");
          setDirty(false);
          setSavedMessage("");
          setOpen(true);
        }}
      >
        {record
          ? "Kelola proses"
          : kind === "calibration"
            ? "Ajukan Kalibrasi"
            : "Mulai proses HRGA"}
      </Button>
      <Modal
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
        size="large"
        title={
          kind === "calibration"
            ? "Form Permintaan Kalibrasi Peralatan"
            : "Proses perpanjangan kompetensi"
        }
        description={
          kind === "calibration"
            ? "FOR/SCI-UMA/197 Rev. 02 · Lengkapi formulir, cetak, dapatkan tanda tangan pengaju dan Kabid, kemudian unggah PDF untuk diajukan ke PTK."
            : "Status proses terpisah dari masa berlaku. Sertifikat lama dan riwayatnya tetap disimpan."
        }
      >
        <form
          key={String(current?.id || "new")}
          onSubmit={(e) => {
            e.preventDefault();
            void save(e.currentTarget);
          }}
          className="space-y-4"
          onChange={() => {
            setDirty(true);
            setSavedMessage("");
          }}
        >
          {kind === "calibration" && (
            <dl className="grid gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-2">
              {[
                ["name", "Nama alat"],
                ["tag", "Tag / inventaris"],
                ["serial", "Nomor seri"],
                ["location", "Lokasi"],
                ["measurement_range", "Range / kapasitas"],
              ].map(([key, label]) => (
                <div key={key}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-semibold">
                    {String(
                      (current?.equipment_snapshot as Row | undefined)?.[key] ??
                        initialValues[key] ??
                        "—",
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {current && (
            <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold">
              Status: {labels[status]}
            </p>
          )}
          {kind === "calibration" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["request_number", "Nomor permintaan"],
                  ["unit_name", "Unit kerja / bagian"],
                  ["quantity", "Jumlah peralatan", "number"],
                  ["laboratory", "Lembaga kalibrasi"],
                  ["resolution_class", "Resolusi / kelas"],
                ].map(([k, l, t]) => field(k, l, t))}
                <label className="grid gap-1 text-xs">
                  Mengetahui / menyetujui · Kepala Bidang / Kepala UP
                  <select
                    name="supervisor_profile_id"
                    className={inputClass}
                    defaultValue={String(current?.supervisor_profile_id || "")}
                    disabled={!!current && !canEdit}
                  >
                    <option value="">Pilih Kepala Bidang / Kepala UP</option>
                    {current?.supervisor_profile_id &&
                    !supervisors.some(
                      (s) => s.id === current.supervisor_profile_id,
                    ) ? (
                      <option value={String(current.supervisor_profile_id)}>
                        {String(current.supervisor_name)} · pilihan terdahulu
                      </option>
                    ) : null}
                    {supervisors.map((s) => (
                      <option key={`${s.id}-${s.label}`} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <dl className="grid gap-3 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Pengaju / pengguna</dt>
                  <dd className="font-semibold">
                    {String(
                      current?.requester_name ||
                        initialValues.requester_name ||
                        "—",
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    NPP pengaju · dari direktori
                  </dt>
                  <dd className="font-semibold">
                    {String(
                      current?.requester_npp ??
                        initialValues.requester_npp ??
                        "Non-NPP",
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tanggal draf · WITA</dt>
                  <dd className="font-semibold">
                    {current
                      ? formatBusinessDate(
                          draftBusinessDate(current.created_at),
                        )
                      : "Otomatis saat draf disimpan"}
                  </dd>
                </div>
              </dl>
              <fieldset className="space-y-2 rounded-lg border border-border p-3">
                <legend className="px-1 text-xs font-semibold">
                  B. Waktu & biaya · diisi PTK / Fungsi Umum
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {field(
                    "estimated_days",
                    "Perkiraan hari kerja (opsional)",
                    "number",
                  )}
                  {field(
                    "estimated_cost",
                    "Perkiraan biaya IDR (opsional)",
                    "number",
                  )}
                </div>
                {!canEstimate && (
                  <p className="text-xs text-muted-foreground">
                    Bagian ini diisi PTK / Fungsi Umum setelah diajukan; pengaju
                    tidak dapat mengisinya.
                  </p>
                )}
              </fieldset>
              {current && canEdit && (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <label className="block text-xs font-semibold">
                    PDF dengan tanda tangan pengaju & Kabid
                    <input
                      className="mt-2 block text-xs"
                      type="file"
                      accept="application/pdf"
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void upload(f);
                      }}
                    />
                  </label>
                  {document && (
                    <p role="status" className="text-xs text-emerald-800">
                      PDF tersimpan privat. Simpan untuk menautkan ke
                      permintaan.
                    </p>
                  )}
                  <label className="flex gap-2 text-xs">
                    <input
                      type="checkbox"
                      name="requester_signed"
                      defaultChecked={current.requester_signed === true}
                    />
                    Saya memastikan tanda tangan pengaju tercantum di PDF.
                  </label>
                  <label className="flex gap-2 text-xs">
                    <input
                      type="checkbox"
                      name="supervisor_signed"
                      defaultChecked={current.supervisor_signed === true}
                    />
                    Saya memastikan tanda tangan pejabat yang dipilih tercantum
                    di PDF.
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Konfirmasi ini merupakan pernyataan pengaju.
                    Keaslian/kelengkapan dokumen diperiksa PTK.
                  </p>
                </div>
              )}
              {status === "accepted" && (
                <label className="grid gap-1 text-xs">
                  Hasil kalibrasi baru (catat melalui Tambah peristiwa
                  kalibrasi)
                  <select
                    name="calibration_id"
                    defaultValue={String(current?.calibration_id || "")}
                    className={inputClass}
                  >
                    <option value="">Pilih hasil kalibrasi</option>
                    {calibrationResults.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">
              Tahap berikutnya
              <select
                name="status"
                className={inputClass}
                defaultValue={status}
              >
                <option value={status}>
                  {labels[status]}
                  {current ? " — simpan catatan" : ""}
                </option>
                {transitions.map((s) => (
                  <option key={s} value={s}>
                    {labels[s]}
                  </option>
                ))}
              </select>
            </label>
            {kind === "personnel" && status === "processing" && (
              <label className="grid gap-1 text-xs">
                Sertifikat pengganti (wajib untuk selesai)
                <select
                  name="replacement_certificate_id"
                  className={inputClass}
                  defaultValue=""
                >
                  <option value="">Pilih sertifikat baru</option>
                  {replacements.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <label className="grid gap-1 text-xs">
            Catatan proses / alasan
            <textarea
              required
              minLength={8}
              maxLength={4000}
              name="notes"
              defaultValue={String(current?.notes || "")}
              className="min-h-20 rounded-md border border-input p-2"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-800">
              {error}
            </p>
          )}
          {kind === "calibration" && savedMessage && (
            <p role="status" className="text-sm text-emerald-800">
              {savedMessage}
            </p>
          )}
          {kind === "calibration" && current && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
              <CalibrationFormPreview
                id={String(current.id)}
                version={Number(current.version)}
                disabled={dirty || busy}
              />
              {dirty && (
                <span className="text-xs text-amber-900">
                  Simpan perubahan untuk memperbarui preview dan PDF.
                </span>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Tutup
            </Button>
            <Button disabled={busy}>
              {busy ? "Menyimpan…" : current ? "Simpan proses" : "Simpan draf"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
