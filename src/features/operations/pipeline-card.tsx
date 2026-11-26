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
      className="min-w-0 rounded-lg border border-border bg-white p-3 shadow-sm"
    >
      <div className="flex items-start gap-1">
      <Link
        className="min-w-0 flex-1 line-clamp-2 break-words text-sm font-bold leading-5 text-primary-hover hover:underline"
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
        className="mt-1 break-words text-[11px] text-muted-foreground"
      >
        {String(
          row.certificate_number || "Nomor belum diisi",
        )}
      </p>
      <p
        title={String(row.certificate_type_name)}
        className="mt-1 line-clamp-2 text-[11px] text-muted-foreground"
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
    <Card className={"flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t-4 bg-slate-50 " + color}>
      <div className="shrink-0 border-b border-border bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold">{label}</h2>
          <span className="shrink-0 rounded-full border border-border bg-slate-50 px-2 py-0.5 text-xs font-semibold tabular-nums">{count}</span>
        </div>
        <p className="mt-2 text-[11px] tabular-nums">{formatRupiah(amount)}</p>
      </div>
      <div
        role="region"
        aria-label={"Daftar " + label}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3 [scrollbar-gutter:stable] focus-visible:outline-offset-[-3px]"
      >
        {children}
      </div>
    </Card>
  );
}
