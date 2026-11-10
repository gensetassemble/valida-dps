import { measurementInputs } from "./measurement-groups";

export function MeasurementSummary({ row, field, assetRanges = false }: {
  row: Record<string, unknown>; field: "measurement_range" | "correction_factor"; assetRanges?: boolean;
}) {
  const values = measurementInputs(row, assetRanges).map(group => String(group[field] ?? "").replace(/\\n/g, "\n").trim());
  if (values.length <= 1) return <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{values[0] || "—"}</span>;
  return <ol className="space-y-2" aria-label={field === "measurement_range" ? "Daftar rentang ukur" : "Faktor koreksi per kelompok"}>
    {values.map((value, index) => <li key={index} className="flex min-w-0 gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{index + 1}.</span>
      <span className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{value || "—"}</span>
    </li>)}
  </ol>;
}
