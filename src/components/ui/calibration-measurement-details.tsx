"use client";

import { Popover } from "radix-ui";
import { X } from "lucide-react";
import { monitoringValue } from "@/features/operations/monitoring";

export function CalibrationMeasurementDetails({
  row,
  field,
}: {
  row: Record<string, unknown>;
  field: "measurement_range" | "correction_factor";
}) {
  const source = Array.isArray(row.monitoring_measurements)
    ? row.monitoring_measurements.filter(
        (group): group is Record<string, unknown> =>
          !!group && typeof group === "object" && !Array.isArray(group),
      )
    : [];
  const groups = (source.length ? source : [row]).map((group) => ({
    range: String(group.measurement_range ?? row.measurement_range ?? "").replace(/\\n/g, "\n"),
    correction: String(group.correction_factor ?? row.correction_factor ?? "").replace(/\\n/g, "\n"),
  }));
  const available = monitoringValue(row, field).trim();
  if (!available || available === "-") return <span>—</span>;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="block w-full whitespace-normal text-left text-xs hover:text-primary-hover">
          <span className="block font-semibold">
            {field === "measurement_range" ? `${groups.length} kelompok pengukuran` : "Faktor koreksi tersedia"}
          </span>
          <span className="mt-1 block text-[10px] text-primary-hover underline underline-offset-2">Lihat rincian</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="bottom" align="end" sideOffset={8} collisionPadding={12}
          aria-label="Rincian rentang ukur dan faktor koreksi"
          className="z-[60] w-[min(40rem,calc(100vw-1.5rem)) rounded-xl border border-border bg-white p-4 text-foreground shadow-xl">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Rentang ukur & faktor koreksi</h3>
              <p className="mt-1 break-words text-xs text-muted-foreground">{String(row.name || "Alat")} · {String(row.tag || "Tanpa tag")}</p>
            </div>
            <Popover.Close aria-label="Tutup rincian" className="rounded-md p-1 hover:bg-slate-100"><X className="size-4" /></Popover.Close>
          </div>
          <div className="max-h-[min(55dvh,28rem)] space-y-2 overflow-y-auto overscroll-contain">
            {groups.map((group, index) => (
              <div key={index} className="rounded-lg border border-border bg-slate-50 p-3">
                <p className="mb-2 text-[10px] font-semibold text-muted-foreground">Kelompok {index + 1}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><p className="mb-1 text-[10px] font-semibold">Rentang / kapasitas</p><p className="whitespace-pre-wrap break-words text-xs">{group.range || "—"}</p></div>
                  <div><p className="mb-1 text-[10px] font-semibold">Faktor koreksi</p><p className="whitespace-pre-wrap break-words text-xs tabular-nums">{group.correction || "—"}</p></div>
                </div>
              </div>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
