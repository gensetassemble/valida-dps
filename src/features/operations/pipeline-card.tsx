import { Card } from "@/components/ui/card";
import Link from "next/link";
import type { ReactNode } from "react";
import type { DataRow } from "@/features/master-data/server";
import { StatusBadge } from "@/components/ui/status-badge";
import { DeadlineDate } from "@/components/ui/deadline-date";
import { formatRupiah } from "@/lib/format";
import { remainingDays } from "@/lib/domain/validity";
function remainingText(value: unknown) {
  const days = typeof value === "string" ? remainingDays(value) : null;
  return days === null
    ? "Tanggal belum diketahui"
    : days < 0
      ? Math.abs(days) + " hari lewat"
      : days + " hari lagi";
}
export function PipelineCard({ row, branch, accountManager, dragHandle, children }: {
  row: DataRow; branch: string; accountManager: string; dragHandle?: ReactNode; children: ReactNode;
}) {
  return (
    <article
      className="min-w-0 rounded-lg border border-border bg-white p-2.5 shadow-sm"
    >
      <div className="flex items-start gap-1">
      <Link
        className="min-w-0 flex-1 line-clamp-2 break-words text-xs font-bold leading-4 text-brand-navy hover:underline"
        title={String(row.client_name)}
        href={
          "/sertifikat-klien/" +
          row.id +
          "?branch=" +
          branch
        }
      >
        {String(row.client_name)}
      </Link>
      {dragHandle}
      </div>
      <p
        title={String(row.certificate_number || "")}
        className="mt-1 truncate text-[10px] text-muted-foreground"
      >
        {String(
          row.certificate_number || "Nomor belum diisi",
        )}
      </p>
      <p
        title={String(row.certificate_type_name)}
        className="mt-1 line-clamp-1 text-[10px] text-muted-foreground"
      >
        {String(row.certificate_type_name)}
      </p>
      <div className="my-2 rounded-md bg-surface-muted px-2 py-1.5 text-[10px]">
        <p className="flex flex-wrap items-center justify-between gap-1">
          <span title="Tanggal jatuh tempo"><DeadlineDate value={row.expiry_date} /></span>
          <StatusBadge value={String(row.validity_status)} />
        </p>
        <p className="mt-0.5 text-muted-foreground">{remainingText(row.expiry_date)}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <p className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground" title={accountManager}>
        {accountManager}
      </p>
      <p className="text-[11px] font-semibold text-primary-hover tabular-nums">
        {formatRupiah(
          String(
            row.previous_order_value_text ||
              row.previous_order_value ||
              "0",
          ),
        )}
      </p>
      </div>
      {children}
    </article>
  );
}

export function PipelineColumn({label, color, count, amount, children}: {
  label: string; color: string; count: number; amount: string; children: ReactNode;
}) {
  return (
    <Card className={"min-h-48 min-w-0 flex-1 border-t-4 bg-slate-50 p-2.5 " + color}>
      <div className="sticky top-14 z-10 -mx-2.5 -mt-2.5 mb-2 rounded-t-lg border-b border-border bg-slate-50 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold">{label}</h2>
          <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] tabular-nums">{count}</span>
        </div>
        <p className="mt-2 text-[11px] tabular-nums">{formatRupiah(amount)}</p>
      </div>
      {children}
    </Card>
  );
}
