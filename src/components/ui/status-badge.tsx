import { cn } from "@/lib/utils";
const statuses: Record<
  string,
  { label: string; style: string; color?: string }
> = {
  true: {
    label: "Aktif",
    style: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  false: {
    label: "Nonaktif",
    style: "bg-slate-100 text-slate-700 border-slate-200",
  },
  active: {
    label: "Aktif",
    style: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  inactive: {
    label: "Nonaktif",
    style: "bg-slate-100 text-slate-700 border-slate-200",
  },
  unknown: {
    label: "Belum Dikonfirmasi",
    style: "bg-amber-50 text-amber-900 border-amber-200",
  },
  pending: {
    label: "Menunggu Verifikasi",
    style: "bg-amber-50 text-amber-900 border-amber-200",
  },
  verified: {
    label: "Terverifikasi",
    style: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  rejected: {
    label: "Ditolak",
    style: "bg-red-50 text-red-800 border-red-200",
  },
  Kedaluwarsa: {
    label: "Kedaluwarsa",
    style: "bg-orange-50 text-orange-900 border-orange-200",
    color: "#D9653F",
  },
  Kritis: {
    label: "Kritis",
    style: "bg-amber-50 text-amber-900 border-amber-200",
    color: "#E8A33D",
  },
  Perhatian: {
    label: "Perhatian",
    style: "bg-yellow-50 text-yellow-900 border-yellow-300",
    color: "#D0A800",
  },
  Pantau: {
    label: "Pantau",
    style: "bg-emerald-50 text-emerald-900 border-emerald-200",
    color: "#6FD3A3",
  },
  Aman: {
    label: "Aman",
    style: "bg-emerald-50 text-emerald-900 border-emerald-200",
    color: "#1F9D6B",
  },
  "Berlaku Seumur Hidup": {
    label: "Berlaku Seumur Hidup",
    style: "bg-violet-50 text-violet-900 border-violet-200",
  },
  "Tanpa Kedaluwarsa (perlu verifikasi dokumen)": {
    label: "Tanpa Kedaluwarsa (perlu verifikasi dokumen)",
    style: "bg-amber-50 text-amber-900 border-amber-200",
  },
  "Tidak Layak Pakai": {
    label: "Tidak Layak Pakai",
    style: "bg-red-50 text-red-900 border-red-200",
  },
  "Layak Pakai": {
    label: "Layak Pakai",
    style: "bg-emerald-50 text-emerald-900 border-emerald-200",
  },
};
export function StatusBadge({ value }: { value: string | boolean }) {
  const status = statuses[String(value)] || {
    label: String(value),
    style: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold",
        status.style,
      )}
    >
      {status.color && (
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: status.color }}
          aria-hidden
        />
      )}
      {status.label}
    </span>
  );
}
