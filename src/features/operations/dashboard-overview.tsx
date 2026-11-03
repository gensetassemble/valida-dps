import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileStack,
} from "lucide-react";
import { Card } from "@/components/ui/card";
const statuses = [
  {
    name: "Aman",
    hint: "> 90 hari",
    color: "#1f9d6b",
    cls: "border-emerald-200 text-emerald-700",
    Icon: CheckCircle2,
  },
  {
    name: "Pantau",
    hint: "61–90 hari",
    color: "#0d9488",
    cls: "border-teal-200 text-teal-700",
    Icon: Activity,
  },
  {
    name: "Perhatian",
    hint: "31–60 hari",
    color: "#d49a00",
    cls: "border-yellow-300 text-yellow-800",
    Icon: Clock3,
  },
  {
    name: "Kritis",
    hint: "0–30 hari",
    color: "#ea920c",
    cls: "border-amber-300 text-amber-700",
    Icon: AlertTriangle,
  },
  {
    name: "Expired",
    hint: "Lewat tanggal akhir",
    color: "#dc4c4c",
    cls: "border-red-200 text-red-700",
    Icon: AlertTriangle,
  },
];
export function DashboardOverview({
  total,
  buckets,
  lifetime,
  unfit,
  showCalibrations,
}: {
  total: number;
  buckets: Record<string, number>;
  lifetime: number;
  unfit: number;
  showCalibrations: boolean;
}) {
  const series = [
    ...statuses.map((s) => ({ ...s, value: buckets[s.name] || 0 })),
    {
      name: "Tanggal belum diisi",
      color: "#94a3b8",
      value: buckets["Tanggal Belum Diisi"] || 0,
    },
    { name: "Seumur hidup", color: "#8b5cf6", value: lifetime },
  ];
  const sum = series.reduce((n, s) => n + s.value, 0);
  const attention = (buckets.Expired || 0) + (buckets.Kritis || 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Card className="px-3 py-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <FileStack size={13} />
            Total dokumen
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-brand-navy">
            {total}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Rekaman aktif
          </p>
        </Card>
        {statuses.map(({ name, hint, cls, Icon }) => (
          <Card key={name} className={`px-3 py-3 ${cls}`}>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide">
              <Icon size={13} />
              {name}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {buckets[name] || 0}
            </p>
            <p className="mt-1 text-[10px]">{hint}</p>
          </Card>
        ))}
      </div>
      <Card className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <figure
          aria-label={`Komposisi masa berlaku: ${series.map((s) => `${s.name} ${s.value}`).join(", ")}`}
        >
          <figcaption className="mb-3 text-xs font-bold text-brand-navy">
            Komposisi masa berlaku
          </figcaption>
          <div
            className="flex h-5 overflow-hidden rounded-full bg-slate-100"
            aria-hidden="true"
          >
            {series
              .filter((s) => s.value)
              .map((s) => (
                <span
                  key={s.name}
                  className="border-r-2 border-white last:border-r-0"
                  style={{
                    width: `${sum ? (s.value / sum) * 100 : 0}%`,
                    background: s.color,
                  }}
                  title={`${s.name}: ${s.value}`}
                />
              ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-muted-foreground">
            {series.map((s) => (
              <span key={s.name} className="inline-flex items-center gap-1.5">
                <i
                  className="size-2 rounded-full"
                  style={{ background: s.color }}
                />
                {s.name} <strong className="text-brand-navy">{s.value}</strong>
              </span>
            ))}
          </div>
        </figure>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Prioritas tindakan
            </p>
            <p className="mt-1 text-xs text-brand-navy">
              <strong className="text-xl">{attention}</strong> expired / kritis
            </p>
            {showCalibrations && (
              <p className="mt-1 text-[10px] text-red-700">
                {unfit} alat tidak layak pakai
              </p>
            )}
          </div>
          <AlertTriangle size={25} className="shrink-0 text-amber-500" />
        </div>
      </Card>
    </div>
  );
}
