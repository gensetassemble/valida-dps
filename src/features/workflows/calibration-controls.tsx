"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  submitEquipmentRequest,
  updateEquipmentRequestProgress,
} from "./calibration-actions";
type Option = { id: string; label: string };
export function EquipmentRequestForm({
  branch,
  equipment,
  unit,
  supervisors,
}: {
  branch: string;
  equipment: string;
  unit: string;
  supervisors: Option[];
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  const cls =
    "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm";
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Ajukan perbaikan / kalibrasi
      </Button>
      <Modal
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
        size="large"
        title="Form permintaan perbaikan / kalibrasi"
        description="FOR/SCI-UMA/197 · Setelah diajukan, unduh Excel untuk dilanjutkan manual. Biaya dan hari kerja dikosongkan."
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const f = new FormData(e.currentTarget);
              const result = await submitEquipmentRequest(branch, {
                equipment_id: equipment,
                request_kind: String(f.get("request_kind")),
                request_number: String(f.get("request_number")),
                unit_name: String(f.get("unit_name")),
                quantity: Number(f.get("quantity")),
                laboratory: String(f.get("laboratory")),
                resolution_class: String(f.get("resolution_class")),
                supervisor_profile_id:
                  String(f.get("supervisor_profile_id") || "") || null,
                notes: String(f.get("notes")),
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
            Jenis permintaan
            <select name="request_kind" className={cls}>
              <option value="calibration">Kalibrasi</option>
              <option value="repair">Perbaikan</option>
            </select>
          </label>
          {[
            ["request_number", "Nomor permintaan"],
            ["unit_name", "Unit kerja / bagian"],
            ["quantity", "Jumlah peralatan"],
            ["laboratory", "Lembaga perbaikan / kalibrasi"],
            ["resolution_class", "Resolusi / kelas"],
          ].map(([key, label]) => (
            <label key={key} className="grid gap-1 text-xs">
              {label}
              <input
                name={key}
                className={cls}
                defaultValue={
                  key === "unit_name" ? unit : key === "quantity" ? 1 : ""
                }
                type={key === "quantity" ? "number" : "text"}
                required={["request_number", "unit_name", "quantity"].includes(
                  key,
                )}
                min={key === "quantity" ? 1 : undefined}
                max={key === "quantity" ? 10000 : undefined}
                maxLength={200}
              />
            </label>
          ))}
          <label className="grid gap-1 text-xs">
            Pejabat mengetahui / menyetujui (opsional)
            <select name="supervisor_profile_id" className={cls}>
              <option value="">Dilengkapi manual</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs sm:col-span-2">
            Keterangan / alasan permintaan
            <textarea
              name="notes"
              required
              minLength={8}
              maxLength={4000}
              className="min-h-24 rounded-lg border border-input p-3"
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
            <Button disabled={busy}>
              {busy ? "Mengajukan…" : "Ajukan & unduh Excel"}
            </Button>
          </div>
        </form>
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
