"use client";
import { useState } from "react";
import { calibrationLaboratories } from "@/features/operations/calibration-laboratories";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  submitEquipmentRequest,
  equipmentRequestOptions,
  updateEquipmentRequestProgress,
  manageEquipmentRequest,
} from "./calibration-actions";
import { umaRequestNumber, umaUnit, umaApproverTitle } from "./uma-format";
import { todayWita } from "@/lib/domain/validity";
type Option = { id: string; label: string };
export function EquipmentRequestCleanup({
  branch,
  id,
  version,
  operation,
}: {
  branch: string;
  id: string;
  version: number;
  operation: "cancel" | "delete_history";
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  const deleting = operation === "delete_history",
    label = deleting ? "Hapus histori" : "Batalkan pengajuan";
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="text-red-700"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Modal
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
        title={label}
        description={
          deleting
            ? "Pengajuan ini dihapus dari daftar histori. Notifikasi terkait diarsipkan dari inbox dan hitungan belum dibaca. Jejak audit tetap tersimpan. Data alat dan hasil kalibrasi tidak dihapus."
            : "Pengajuan dihentikan dan berstatus Dibatalkan. Anda dapat membuat pengajuan baru setelahnya."
        }
      >
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Kembali
          </Button>
          <Button
            className="bg-red-700 text-white hover:bg-red-800"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const result = await manageEquipmentRequest(
                  branch,
                  id,
                  version,
                  operation,
                );
                if (result.error) setError(result.error);
                else {
                  setOpen(false);
                  router.refresh();
                }
              } catch {
                setError("Tindakan belum tersimpan. Silakan coba lagi.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy
              ? "Menyimpan…"
              : deleting
                ? "Ya, hapus histori"
                : "Ya, batalkan"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
export function EquipmentRequestForm({
  branch,
  equipment,
}: {
  branch: string;
  equipment?: string;
  unit?: string;
  supervisors?: Option[];
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<
    {
      id: string;
      name: string;
      tag: string | null;
      location: string | null;
      portfolio_id: string;
      code: string;
      unavailable: boolean;
    }[]
  >([]);
  const [heads, setHeads] = useState<Option[]>([]),
    [portfolio, setPortfolio] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState(""),
    [sequence, setSequence] = useState("");
  const router = useRouter();
  const cls =
    "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm";
  const code =
    tools.find((t) => t.portfolio_id === portfolio)?.code || "PORTOFOLIO";
  async function show() {
    setTools([]);
    setHeads([]);
    setSelected([]);
    setPortfolio("");
    setSearch("");
    setSequence("");
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const r = await equipmentRequestOptions(branch);
      if (r.error) {
        setError(r.error);
        return;
      }
      setTools(r.tools || []);
      setHeads(r.supervisors || []);
      const initial = r.tools?.find(
        (t) => t.id === equipment && !t.unavailable,
      );
      setPortfolio(initial?.portfolio_id || "");
      setSelected(initial ? [initial.id] : []);
    } catch {
      setError("Pilihan alat belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <Button size="sm" onClick={() => void show()}>
        Ajukan perbaikan / kalibrasi
      </Button>
      <Modal
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
        size="large"
        title="Pengajuan perbaikan / kalibrasi alat"
        description="FOR/SCI-UMA/197 · Pilih alat dalam satu portofolio. Progres PTK berlaku untuk seluruh bundel. Biaya dan hari kerja diisi manual di Excel."
      >
        {loading ? (
          <p role="status">Memuat pilihan alat…</p>
        ) : (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!selected.length) {
                setError("Pilih minimal satu alat.");
                return;
              }
              setBusy(true);
              setError("");
              try {
                const f = new FormData(e.currentTarget);
                const result = await submitEquipmentRequest(branch, {
                  equipment_id: selected[0],
                  equipment_ids: selected,
                  request_kind: String(f.get("request_kind")),
                  request_number: sequence,
                  laboratory: String(f.get("laboratory") || ""),
                  resolution_class: "",
                  supervisor_profile_id: String(
                    f.get("supervisor_profile_id") || "",
                  ),
                  notes: String(f.get("notes") || ""),
                  signature_place: String(
                    f.get("signature_place") || "Denpasar",
                  ),
                  certificate_name: String(f.get("certificate_name") || ""),
                  certificate_address: String(
                    f.get("certificate_address") || "",
                  ),
                  item_details: Object.fromEntries(
                    selected.map((id) => [
                      id,
                      {
                        resolution_class: String(
                          f.get("resolution_" + id) || "",
                        ),
                        instrument_reading: String(
                          f.get("reading_" + id) || "",
                        ),
                      },
                    ]),
                  ),
                });
                if (result.error) setError(result.error);
                else {
                  setOpen(false);
                  router.refresh();
                  window.location.assign(
                    "/api/workflows/form?id=" +
                      result.id +
                      "&format=xlsx&download=1",
                  );
                }
              } catch {
                setError("Pengajuan belum tersimpan. Silakan coba lagi.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="grid gap-1 text-xs">
              Portofolio
              <select
                required
                className={cls}
                value={portfolio}
                onChange={(e) => {
                  setPortfolio(e.target.value);
                  setSelected([]);
                }}
              >
                <option value="">Pilih portofolio</option>
                {[
                  ...new Map(
                    tools.map((t) => [t.portfolio_id, t.code]),
                  ).entries(),
                ].map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              Jenis permintaan
              <select name="request_kind" className={cls}>
                <option value="calibration">Kalibrasi</option>
                <option value="repair">Perbaikan</option>
              </select>
            </label>
            <fieldset className="min-w-0 rounded-lg border border-border p-3 sm:col-span-2">
              <legend className="px-1 text-xs font-semibold">
                Pilih alat · {selected.length} dipilih (maks. 50)
              </legend>
              <input
                aria-label="Cari alat untuk pengajuan"
                className={cls}
                placeholder="Cari nama atau tag alat…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="mt-2 max-h-52 overflow-auto">
                {!portfolio ? (
                  <p className="py-3 text-xs text-muted-foreground">
                    Pilih portofolio terlebih dahulu.
                  </p>
                ) : (
                  tools
                    .filter(
                      (t) =>
                        t.portfolio_id === portfolio &&
                        [t.name, t.tag, t.location]
                          .join(" ")
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                    )
                    .map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-3 border-b border-border py-2 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(t.id)}
                          disabled={
                            t.unavailable ||
                            (!selected.includes(t.id) && selected.length >= 50)
                          }
                          onChange={(e) =>
                            setSelected((prev) =>
                              e.target.checked
                                ? [...prev, t.id]
                                : prev.filter((id) => id !== t.id),
                            )
                          }
                        />
                        <span className="min-w-0">
                          <strong>{t.name}</strong>
                          <span className="ml-2 text-muted-foreground">
                            {t.tag || "Tanpa tag"} ·{" "}
                            {t.location || "Lokasi belum diisi"}
                          </span>
                          {t.unavailable && (
                            <span className="ml-2 text-amber-800">
                              Sudah diajukan
                            </span>
                          )}
                        </span>
                      </label>
                    ))
                )}
              </div>
            </fieldset>
            <label className="grid gap-1 text-xs">
              Nomor urut permintaan
              <input
                required
                inputMode="numeric"
                pattern="[0-9]{1,4}"
                maxLength={4}
                className={cls}
                value={sequence}
                onChange={(e) =>
                  setSequence(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="0021"
              />
              <span className="break-all text-muted-foreground">
                {umaRequestNumber(sequence || "XXXX", code, todayWita()) ||
                  "XXXX/DPS-(BULAN)/OPS-" + code + "/(TAHUN)"}{" "}
                · tanggal saat diajukan
              </span>
            </label>
            <label className="grid gap-1 text-xs">
              Unit kerja / bagian
              <input
                className={cls + " bg-slate-50"}
                readOnly
                value={umaUnit(code)}
              />
            </label>
            <label className="grid gap-1 text-xs">
              Pejabat mengetahui / menyetujui
              <select required name="supervisor_profile_id" className={cls}>
                <option value="">Pilih pejabat</option>
                {heads.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.label} — {umaApproverTitle(h.label)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              Tempat penandatanganan
              <input
                required
                name="signature_place"
                maxLength={100}
                className={cls}
                defaultValue="Denpasar"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Lembaga perbaikan / kalibrasi
              <input name="laboratory" list="request-calibration-laboratories" maxLength={200} className={cls} placeholder="Pilih lembaga atau tulis lembaga lain" />
              <datalist id="request-calibration-laboratories">{calibrationLaboratories.map((name) => <option key={name} value={name}/>)}</datalist>
            </label>
            <label className="grid gap-1 text-xs">
              Nama organisasi di sertifikat
              <input
                required
                name="certificate_name"
                maxLength={250}
                className={cls}
                defaultValue="PT SUCOFINDO Cabang Denpasar"
              />
            </label>
            <label className="grid gap-1 text-xs sm:col-span-2">
              Alamat di sertifikat (opsional, dapat dilengkapi manual)
              <input
                name="certificate_address"
                maxLength={1000}
                className={cls}
              />
            </label>
            {selected.length > 0 && (
              <fieldset className="min-w-0 space-y-3 rounded-lg border border-border p-3 sm:col-span-2">
                <legend className="px-1 text-xs font-semibold">
                  Rincian lampiran alat
                </legend>
                {selected.map((id) => {
                  const t = tools.find((t) => t.id === id);
                  return (
                    <div
                      key={id}
                      className="grid gap-2 border-b border-border pb-3 sm:grid-cols-2"
                    >
                      <strong className="text-xs sm:col-span-2">
                        {t?.name} · {t?.tag || "Tanpa tag"}
                      </strong>
                      <label className="grid gap-1 text-xs">
                        Resolusi / kelas (opsional)
                        <input
                          name={"resolution_" + id}
                          maxLength={200}
                          className={cls}
                        />
                      </label>
                      <label className="grid gap-1 text-xs">
                        Keterangan / instrument reading (opsional)
                        <textarea
                          name={"reading_" + id}
                          maxLength={12000}
                          className="min-h-20 rounded-lg border border-input p-2"
                          placeholder="Satu titik pengukuran per baris"
                        />
                      </label>
                    </div>
                  );
                })}
              </fieldset>
            )}
            <label className="grid gap-1 text-xs sm:col-span-2">
              Keterangan / alasan permintaan
              <textarea
                name="notes"
                required
                minLength={8}
                maxLength={4000}
                className="min-h-20 rounded-lg border border-input p-3"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-700 sm:col-span-2">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Batal
              </Button>
              <Button disabled={busy || !selected.length}>
                {busy
                  ? "Mengajukan…"
                  : "Ajukan " + selected.length + " alat & unduh Excel"}
              </Button>
            </div>
          </form>
        )}
        {loading && error && <p role="alert">{error}</p>}
      </Modal>
    </>
  );
}
export function EquipmentProgressButtons({
  branch,
  id,
  version,
  status,
}: {
  branch: string;
  id: string;
  version: number;
  status: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  async function update(next: "accepted" | "completed") {
    setBusy(true);
    setError("");
    try {
      const r = await updateEquipmentRequestProgress(branch, id, version, next);
      if (r.error) setError(r.error);
      else router.refresh();
    } catch {
      setError("Progres belum tersimpan. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== "accepted" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void update("accepted")}
          >
            Mulai Proses
          </Button>
        )}
        <Button
          size="sm"
          disabled={busy}
          onClick={() => void update("completed")}
        >
          {busy ? "Menyimpan…" : "Selesai"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
