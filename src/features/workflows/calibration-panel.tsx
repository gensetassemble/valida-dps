import { requireActiveUser } from "@/lib/auth/guards";
import { masterClient, type DataRow } from "@/features/master-data/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/format";
import {
  EquipmentProgressButtons,
  EquipmentRequestForm,
} from "./calibration-controls";
export async function CalibrationRequestPanel({
  branch,
  row,
}: {
  branch: string;
  row: DataRow;
}) {
  const c = await requireActiveUser(),
    db = await masterClient();
  const coordinator = c.scopes.some(
      (s) => s.branch_code === branch && s.role_code === "coordinator",
    ),
    ptk = c.scopes.some(
      (s) => s.branch_code === branch && s.role_code === "equipment_manager",
    );
  const { data, error } = await db
    .from("calibration_requests")
    .select("*")
    .eq("branch_code", branch)
    .eq("equipment_id", row.id)
    .order("created_at", { ascending: false });
  if (error) throw Error("Pengajuan belum dapat dimuat.");
  const records = (data || []) as DataRow[];
  const active = records.some(
    (r) => !["completed", "cancelled"].includes(String(r.status)),
  );
  const { data: heads } =
    coordinator && !active
      ? await db.rpc("calibration_request_supervisors", { b: branch })
      : { data: [] };
  return (
    <Card className="mb-5 space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold">
          Permintaan perbaikan / kalibrasi · FOR/SCI-UMA/197
        </h2>
        {coordinator && !active && (
          <EquipmentRequestForm
            branch={branch}
            equipment={String(row.id)}
            unit={String(row.unit || row.location || "")}
            supervisors={(heads || []).map(
              (h: { id: string; full_name: string }) => ({
                id: h.id,
                label: h.full_name,
              }),
            )}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Koordinator mengajukan formulir; notifikasi masuk ke PTK. Excel
        dilanjutkan manual. Status selesai tidak mengubah tanggal atau kelayakan
        alat.
      </p>
      {!records.length && <p className="text-xs">Belum ada pengajuan.</p>}
      {records.map((r) => {
        const status = String(r.status),
          label =
            status === "completed"
              ? "Selesai"
              : status === "cancelled"
                ? "Dibatalkan"
                : status === "accepted"
                  ? "Sedang Diproses"
                  : "Sedang Diajukan";
        return (
          <div
            className="space-y-3 rounded-lg border border-border p-3"
            key={String(r.id)}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <strong className="text-sm">
                {String(r.request_number || "Permintaan alat")}
              </strong>
              <span
                className={
                  "rounded-full px-3 py-1 text-xs font-semibold " +
                  (status === "completed"
                    ? "bg-emerald-50 text-emerald-800"
                    : status === "accepted"
                      ? "bg-blue-50 text-blue-800"
                      : "bg-amber-50 text-amber-800")
                }
              >
                {label}
              </span>
            </div>
            <p className="text-xs">
              {r.request_kind === "repair" ? "Perbaikan" : "Kalibrasi"} ·{" "}
              {formatTimestamp(String(r.created_at))} ·{" "}
              {String(r.requester_name || "Pengaju")}
            </p>
            <p className="whitespace-pre-wrap text-xs">{String(r.notes)}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline" asChild>
                <a
                  href={`/api/workflows/form?id=${r.id}&format=xlsx&download=1`}
                >
                  Unduh Excel
                </a>
              </Button>
              {ptk && !["completed", "cancelled"].includes(status) && (
                <EquipmentProgressButtons
                  branch={branch}
                  id={String(r.id)}
                  version={Number(r.version)}
                  status={status}
                />
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
