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
        <button type="button" data-hover="subtle" className="group -mx-1 block w-full rounded-md px-1 py-1 whitespace-normal text-left text-xs transition-colors hover:bg-primary/5 hover:text-primary-hover focus-visible:bg-primary/5">
          <span className="block font-medium">
            {field === "measurement_range" ? `${groups.length} kelompok pengukuran` : "Faktor koreksi tersedia"}
          </span>
          <span className="mt-1 block text-[10px] text-primary-hover underline underline-offset-2">Lihat rincian</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="bottom" align="end" sideOffset={8} collisionPadding={12}
          aria-label="Rincian rentang ukur dan faktor koreksi"
          className="z-[60] flex max-h-[min(65dvh,var(--radix-popover-content-available-height))] w-[min(28rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-border bg-white p-3 text-foreground shadow-xl">
          <div className="mb-2 flex shrink-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Rentang ukur & faktor koreksi</h3>
              <p className="mt-1 break-words text-[11px] text-muted-foreground">{String(row.name || "Alat")} · {String(row.tag || "Tanpa tag")}</p>
            </div>
            <Popover.Close aria-label="Tutup rincian" className="rounded-md p-1 hover:bg-slate-100"><X className="size-4" /></Popover.Close>
          </div>
          <div className="min-h-0 max-h-88 overflow-y-auto overscroll-contain rounded-lg border border-border">
            <table className="w-full table-fixed text-left text-xs">
              <colgroup><col/><col className="w-28"/></colgroup>
              <thead className="sticky top-0 bg-surface-muted text-[10px] text-muted-foreground"><tr>
                <th scope="col" className="px-2.5 py-2">Rentang / kapasitas</th>
                <th scope="col" className="px-2.5 py-2">Faktor koreksi</th>
              </tr></thead>
              <tbody>{groups.map((group, index) => <tr key={index} className="border-t border-border align-top">
                <td className="px-2.5 py-2"><span className="mb-1 block text-[10px] font-semibold text-muted-foreground">Kelompok {index + 1}</span><span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{group.range || "—"}</span></td>
                <td className="px-2.5 py-2 whitespace-pre-wrap break-words tabular-nums [overflow-wrap:anywhere]">{group.correction || "—"}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
