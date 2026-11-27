"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { certificateFrozenColumn, certificateColumnWidth, emailColumnWidth } from "./certificate-table-layout";
import { DeadlineDate } from "./deadline-date";
import { DeadlineRemaining } from "./deadline-remaining";
import { CalibrationMeasurementDetails } from "./calibration-measurement-details";
import { operationalValidity, remainingDays } from "@/lib/domain/validity";
import { ScrollLoader } from "./scroll-loader";
import { useScrollRecords } from "@/features/master-data/use-scroll-records";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Pencil,
  Plus,
  Power,
  LoaderCircle,
} from "lucide-react";
import { Card } from "./card";
import { Button } from "./button";
import { Input } from "./input";
import { StatusBadge } from "./status-badge";
import { EmptyState } from "./empty-state";
import { Modal, ConfirmDialog } from "./modal";
import { useToast } from "./toast";
import { FilterBar } from "@/features/master-data/filter-bar";
import {
  RENEWAL_STATUSES,
  personnelRenewalDisplay,
} from "@/features/workflows/model";
import { DirectoryActionsDialog } from "@/features/master-data/directory-actions-dialog";
import { EmployeeStatusDialog } from "@/features/workflows/employee-status-dialog";
import { businessNotes } from "@/features/operations/notes";
import dynamic from "next/dynamic";
const RecordForm = dynamic(
  () => import("@/features/master-data/record-form").then((m) => m.RecordForm),
  { loading: () => <p className="p-4 text-xs">Memuat formulir…</p> },
);
import { setRecordsActive } from "@/features/master-data/actions";
import type { EntityConfig } from "@/features/master-data/registry";
import type { DataRow } from "@/features/master-data/server";
import {
  monitoringColumns,
  monitoringHeaders,
  monitoringValue,
} from "@/features/operations/monitoring";
import {
  formatBusinessDate,
  formatTimestamp,
  formatRupiah,
} from "@/lib/format";
const centeredCalibrationColumns = new Set([
  "item_condition",
  "item_status",
  "monitoring_interval",
  "latest_calibration_date",
  "latest_due_date",
  "calibration_internal",
  "calibration_external",
  "significant_yes",
  "significant_no",
]);
type TableData = {
  rows: DataRow[];
  labels: Record<string, Record<string, string>>;
  total: number;
  page: number;
  size: number;
  sort: string;
  dir: string;
};
const extraLabels: Record<string, string> = {
  marketing_pic_name: "PIC Portofolio (AM / Marketing)",
  updated_at: "Diperbarui",
  granted_at: "Diberikan",
  revoked_at: "Dicabut",
  table_name: "Tabel",
  record_id: "ID rekaman",
  action: "Perubahan",
  actor_id: "Aktor",
  occurred_at: "Waktu (WITA)",
  client_name: "Pelanggan",
  employee_name: "Pegawai",
  equipment_name: "Alat",
  certificate_type_name: "Jenis sertifikat",
  validity_status: "Masa berlaku",
  eligibility_status: "Kelayakan alat",
  latest_due_date: "Batas kalibrasi",
  due_date: "Tanggal berakhir",
  days_remaining: "Sisa hari",
  npp: "NPP",
  work_area_name: "Wilayah",
  account_manager_name: "Account Manager (AM)",
  portfolio_code: "Portofolio",
  interval_label: "Interval",
  pic_name: "PIC perusahaan",
  pic_email: "Email PIC",
  branch_code: "Cabang Operasional",
};
export function DataTable({
  entity,
  branch,
  data: initialData,
  canWrite,
  userId,
  isAdmin,
  canManagePasswords = false,
  canManageDirectory = false,
  parent,
  hideFilters = false,
}: {
  entity: EntityConfig;
  branch: string;
  data: TableData;
  canWrite: boolean;
  userId: string;
  isAdmin: boolean;
  canManagePasswords?: boolean;
  canDeleteEquipment?: boolean;
  canManageDirectory?: boolean;
  parent?: { field: string; id: string };
  hideFilters?: boolean;
}) {
  const routeParams = useSearchParams();
  const query = new URLSearchParams(hideFilters ? "" : routeParams.toString());
  if (hideFilters) {
    for (const key of ["sort", "dir"])
      if (routeParams.get(key)) query.set(key, routeParams.get(key)!);
  }
  query.set("entity", entity.key);
  query.set("branch", branch);
  if (parent) {
    query.set("parent_field", parent.field);
    query.set("parent_id", parent.id);
  }
  const scrolling = useScrollRecords(initialData, query.toString());
  const data = scrolling.data;
  const tableScroll = useRef<HTMLDivElement>(null);
  const warmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (warmTimer.current) clearTimeout(warmTimer.current); }, []);
  useEffect(() => { if (tableScroll.current) tableScroll.current.scrollTop = 0; }, [data.sort, data.dir]);
  function writable(row: DataRow) {
    return (
      canWrite &&
      (entity.key !== "pelanggan" ||
        isAdmin ||
        row.account_manager_id === userId)
    );
  }
  const writableRows = data.rows.filter(writable);
  const [editing, setEditing] = useState<DataRow | "new" | null>(null);
  const [viewing, setViewing] = useState<DataRow | null>(null);
  const [selection, setSelected] = useState<string[]>([]);
  const selected = selection.filter((id) =>
    writableRows.some((row) => String(row[entity.idKey]) === id),
  );
  const [change, setChange] = useState<{
    ids: string[];
    active: boolean;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setFailure] = useState<string>();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const notify = useToast();
  const displayColumns =
    entity.key === "sertifikat-klien"
      ? entity.columns.filter(
          (column) =>
            ![
              "work_area_name",
              "interval_months",
              "previous_order_value",
              "account_manager_name",
              "order_reference",
              "branch_code",
              "verification_status",
              "is_active",
            ].includes(column),
        )
      : entity.key === "kalibrasi-alat"
        ? monitoringColumns.map(([key]) => key)
        : entity.key === "kompetensi-personil"
          ? ["validity_status", ...entity.columns.filter(column => column !== "validity_status")]
          : entity.columns;
  const mayBulk =
    canWrite &&
    ![
      "pengguna",
      "penugasan-peran",
      "penugasan",
      "cabang",
      "kalibrasi-alat",
      "kompetensi-personil",
      "pegawai",
    ].includes(entity.key);
  const frozenCertificates = ["sertifikat-klien", "kompetensi-personil"].includes(entity.key);
  const certificateColumns = ["number", ...(mayBulk ? ["selection"] : []), ...displayColumns];
  const detailColumn = entity.detailColumn || (displayColumns.includes(entity.labelKey) ? entity.labelKey : displayColumns[0]);
  function protectedRecord(row: DataRow) {
    const id = String(row[entity.idKey]);
    return (entity.key === "pengguna" && id === userId) || (entity.key === "penugasan-peran" && row.profile_id === userId) ||
      (entity.key === "penugasan" && !isAdmin && row.assignment_type !== "personnel");
  }
  const columnWidth = (column:string) => /email/i.test(column) ? emailColumnWidth(data.rows.map(row=>row[column])) : certificateColumnWidth(column);
  const requestedSort = params.get("sort");
  const sortAliases: Record<string, string> = { alphabet: entity.key === "kalibrasi-alat" ? "name" : "original_title", employee: "employee_name", portfolio: entity.key === "kalibrasi-alat" ? "portfolio_code" : "portfolio_sort_key", unit: "owner_unit", priority: "validity_priority" };
  const activeSort = requestedSort && (entity.columns.includes(requestedSort) || displayColumns.includes(requestedSort) || sortAliases[requestedSort]) ? sortAliases[requestedSort] || requestedSort : data.sort;
  const activeDir = params.get("dir") === "desc" ? "desc" : requestedSort ? "asc" : data.dir;
  function navigate(values: Record<string, string>) {
    const next = new URLSearchParams(window.location.search);
    next.delete("page");
    Object.entries(values).forEach(([key, value]) => { if (key !== "page") next.set(key, value); });
    window.history.replaceState(null, "", `${path}?${next}`);
  }
  function warmSort(column: string) {
    if (warmTimer.current) clearTimeout(warmTimer.current);
    warmTimer.current = setTimeout(() => {
      const next = new URLSearchParams(query);
      next.set("sort", column); next.set("dir", activeSort === column && activeDir === "asc" ? "desc" : "asc");
      void scrolling.prefetch(next.toString());
    }, 150);
  }
  const labelFor = (field: string) =>
    (entity.key === "sertifikat-klien" && field === "client_name"
      ? "Pelanggan & wilayah"
      : null) ||
    entity.fields.find((item) => item.key === field)?.label ||
    extraLabels[field] ||
    field;
  function valueFor(row: DataRow, column: string) {
    const processStatus = personnelRenewalDisplay(
      row.renewal_process_status as string | null,
      String(row.validity_status || ""),
      row.validity_kind === "lifetime",
    );
    if (
      entity.key === "kompetensi-personil" &&
      column === "employee_name" &&
      canManageDirectory &&
      typeof row.employee_id === "string"
    )
      return (
        <Link
          className="font-semibold text-primary-hover underline"
          href={`/master-data/pegawai/${row.employee_id}?branch=${encodeURIComponent(branch)}`}
        >
          {String(row.employee_name || "—")}
        </Link>
      );
    if (column === "notes") return businessNotes(row.notes) || "—";
    if (entity.key === "kompetensi-personil" && column === "original_title")
      return (
        <span className="block max-w-72 whitespace-normal">
          {String(row[column] || "—")}
          {processStatus ? (
            <span
              className={
                "mt-1 block w-fit rounded-md px-2 py-1 text-[10px] font-medium " +
                (processStatus === "renewed"
                  ? "bg-emerald-50 text-emerald-900"
                  : processStatus === "processing"
                    ? "bg-blue-50 text-blue-900"
                    : "bg-slate-100 text-slate-700")
              }
            >
              {RENEWAL_STATUSES[processStatus]}
            </span>
          ) : null}
        </span>
      );
    if (column === "npp" && !row.npp) return "Non-NPP";
    if (entity.key === "kompetensi-personil" && column === "validity_status")
      return <span className="flex flex-col items-start gap-1">
        <StatusBadge value={String(row.validity_status || "Tanggal Belum Diisi")} />
        <DeadlineRemaining value={row.expiry_date} lifetime={row.validity_kind === "lifetime"} />
      </span>;
    if (entity.key === "kalibrasi-alat") {
      if (column === "measurement_range" || column === "correction_factor")
        return <CalibrationMeasurementDetails row={row} field={column} />;
      const raw = monitoringValue(row, column);
      const days = remainingDays(String(row.latest_due_date || ""));
      if (column === "due_date" || column === "latest_due_date")
        return <span className="flex flex-col items-center gap-1"><DeadlineDate value={raw} />
          {row.calibration_expiry_needs_review === true && <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Periksa tanggal</span>}
        </span>;
      const display =
        column.endsWith("_date") && /^\d{4}-\d{2}-\d{2}$/.test(raw)
          ? formatBusinessDate(raw)
          : raw;
      return (
        <span
          className={`block min-w-20 max-w-64 whitespace-pre-wrap break-words${centeredCalibrationColumns.has(column) ? " mx-auto text-center" : ""}`}
          title={display}
        >
          <span className="whitespace-normal break-words [overflow-wrap:anywhere]">{display || "—"}</span>
          {column === "name" && (
            <span className="mt-1 block text-[10px] font-semibold text-muted-foreground">
              Portofolio: {String(row.portfolio_code || "Belum dipetakan")}
            </span>
          )}
          {column === "name" && (
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge
                value={operationalValidity(
                  typeof row.latest_due_date === "string"
                    ? row.latest_due_date
                    : null,
                )}
              />
              {days !== null && (
                <span className="text-[10px] text-muted-foreground">
                  {days < 0
                    ? `${Math.abs(days)} hari lewat`
                    : days === 0
                      ? "Hari ini"
                      : `${days} hari lagi`}
                </span>
              )}
            </span>
          )}
        </span>
      );
    }
    const value = row[column];
    if (entity.key === "sertifikat-klien" && column === "client_name")
      return (
        <div className="max-w-56">
          <span className="block font-semibold text-brand-navy">
            {String(value || "—")}
          </span>
          <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {String(row.work_area_name || "Wilayah belum dipetakan")}
          </span>
        </div>
      );
    if (value === null || value === undefined || value === "")
      return <span className="text-muted-foreground">—</span>;
    if (typeof value === "boolean" || column.endsWith("_status"))
      return (
        <StatusBadge
          value={typeof value === "boolean" ? value : String(value)}
        />
      );
    if (column === "previous_order_value") return formatRupiah(String(value));
    if (column.endsWith("_at")) return formatTimestamp(String(value));
    if (
      column.endsWith("_from") ||
      column.endsWith("_until") ||
      column.endsWith("_date")
    )
      return /(?:expiry|due|valid_until|end_date)/.test(column) ? (
        <DeadlineDate value={value} />
      ) : (
        formatBusinessDate(String(value))
      );
    const field = entity.fields.find((field) => field.key === column);
    const display =
      data.labels[column]?.[String(value)] ||
      field?.options?.find((option) => option.value === value)?.label ||
      String(value);
    if (/email/i.test(column)) return <span className="inline-block whitespace-nowrap" title={display}>{display}</span>;
    return (
      <span className="block max-w-64 whitespace-normal break-words [overflow-wrap:anywhere]" title={display}>
        {display}
      </span>
    );
  }
  function beginChange(ids: string[], active: boolean) {
    setFailure(undefined);
    setReason("");
    setChange({ ids, active });
  }
  return (
    <>
      <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4">
          <div>
            <h2 className="text-sm font-bold text-brand-navy">
              {entity.title}
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              <span className="tnum">{data.total}</span> rekaman sesuai akses
              {!hideFilters && " dan filter"}
            </p>
            {scrolling.sorting && <p role="status" className="mt-1 flex items-center gap-1.5 text-[11px] text-primary"><LoaderCircle size={12} aria-hidden="true" className="motion-safe:animate-spin"/>Memperbarui urutan…</p>}
            {scrolling.sortError && <p role="alert" className="mt-1 text-xs text-red-800">{scrolling.sortError} <button type="button" className="font-semibold underline" onClick={() => void scrolling.retrySort()}>Coba lagi</button></p>}
          </div>
          {canWrite && entity.create !== false && (
            <Button onClick={() => setEditing("new")}>
              <Plus />
              Tambah {entity.singular.toLowerCase()}
            </Button>
          )}
        </div>
        {!hideFilters &&
          !["kompetensi-personil", "kalibrasi-alat", "sertifikat-klien"].includes(entity.key) && (
            <FilterBar entity={entity} />
          )}
        {selected.length > 0 && mayBulk && (
          <div className="flex items-center justify-between gap-3 bg-emerald-50 px-4 py-3 text-xs">
            <span>{selected.length} rekaman dipilih yang ditampilkan.</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => beginChange(selected, false)}
            >
              {entity.key === "kalibrasi-alat" ? "Hapus pilihan ke Arsip" : "Nonaktifkan pilihan"}
            </Button>
          </div>
        )}
        {data.rows.length ? (
          <div
            ref={tableScroll}
            role="region"
            aria-busy={scrolling.sorting}
            aria-label={`Tabel ${entity.title}`}
            tabIndex={0}
            style={frozenCertificates ? {"--record-selection": mayBulk ? "2rem" : "0rem"} as CSSProperties : undefined}
            className={
              entity.key === "kalibrasi-alat"
                ? "calibration-table-scroll max-w-full"
                : frozenCertificates ? "certificate-table-scroll max-w-full" : "max-w-full overflow-x-auto"
            }
          >
            <table
              className={
                entity.key === "kalibrasi-alat"
                  ? "calibration-frozen-table text-left text-xs"
                  : frozenCertificates ? "certificate-frozen-table text-left text-xs" : "w-full min-w-[640px] border-collapse text-left text-xs"
              }
              style={frozenCertificates ? {width: `calc(${certificateColumns.map(columnWidth).join(" + ")})`} : undefined}
            >
              {frozenCertificates && <colgroup>{certificateColumns.map((column) => <col key={column} style={{width: columnWidth(column)}} />)}</colgroup>}
              {entity.key === "kalibrasi-alat" && (
                <colgroup>
                  {[
                    "number",
                    ...monitoringColumns.map(([key]) => key),
                  ].map((key) => (
                    <col key={key} />
                  ))}
                </colgroup>
              )}
              <thead className="border-b border-border bg-surface-muted text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {entity.key === "kalibrasi-alat" ? (
                  monitoringHeaders.map((cells, index) => (
                    <tr key={index}>
                      {cells.map(([col, label, colSpan, rowSpan]) => (
                        <th
                          key={col}
                          colSpan={colSpan}
                          rowSpan={rowSpan}
                          scope={colSpan > 1 ? "colgroup" : "col"}
                          aria-sort={colSpan === 1 && col > 1 && activeSort === monitoringColumns[col - 2]?.[0] ? (activeDir === "asc" ? "ascending" : "descending") : undefined}
                          data-frozen={
                            col <= 3
                              ? ["number", "name", "tag"][col - 1]
                              : undefined
                          }
                          className="min-w-16 border border-border px-2 py-2 text-center normal-case tracking-normal"
                        >
                          {colSpan === 1 && col > 1 ? <button type="button"
                            onClick={() => navigate({sort: monitoringColumns[col - 2][0], dir: activeSort === monitoringColumns[col - 2][0] && activeDir === "asc" ? "desc" : "asc", page: "1"})}
                            onPointerEnter={() => warmSort(monitoringColumns[col - 2][0])} onPointerLeave={() => { if (warmTimer.current) clearTimeout(warmTimer.current); }}
                            onFocus={() => warmSort(monitoringColumns[col - 2][0])}
                            className="inline-flex items-center justify-center gap-1" title={`Urutkan ${label}`}>
                            {label}{activeSort === monitoringColumns[col - 2][0] ? activeDir === "asc" ? <ArrowUp size={12}/> : <ArrowDown size={12}/> : <ArrowUpDown size={12}/>}</button> : label}
                        </th>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <th className="w-10 px-4 py-3" scope="col" data-record-frozen={certificateFrozenColumn(entity.key, "number")}>
                      No.
                    </th>
                    {mayBulk && (
                      <th className="w-8 px-2 py-3" scope="col" data-record-frozen={certificateFrozenColumn(entity.key, "selection")}>
                        <input
                          type="checkbox"
                          aria-label="Pilih semua yang ditampilkan"
                          checked={
                            data.rows.length > 0 &&
                            selected.length === writableRows.length
                          }
                          onChange={(event) =>
                            setSelected(
                              event.target.checked
                                ? writableRows.map((row) =>
                                    String(row[entity.idKey]),
                                  )
                                : [],
                            )
                          }
                          className="size-3.5 accent-[#16845a]"
                        />
                      </th>
                    )}
                    {displayColumns.map((column) => (
                      <th
                        key={column}
                        scope="col"
                        data-record-frozen={certificateFrozenColumn(entity.key, column)}
                        aria-sort={
                          activeSort === column
                            ? activeDir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        className="whitespace-nowrap px-4 py-3"
                      >
                        <button
                          onClick={() =>
                            navigate({
                              sort: column,
                              dir:
                                activeSort === column && activeDir === "asc"
                                  ? "desc"
                                  : "asc",
                              page: "1",
                            })
                          }
                          onPointerEnter={() => warmSort(column)} onPointerLeave={() => { if (warmTimer.current) clearTimeout(warmTimer.current); }} onFocus={() => warmSort(column)}
                          className="inline-flex items-center gap-1.5"
                        >
                          {labelFor(column)}
                          {activeSort === column ? (
                            activeDir === "asc" ? (
                              <ArrowUp size={12} />
                            ) : (
                              <ArrowDown size={12} />
                            )
                          ) : (
                            <ArrowUpDown size={12} className="opacity-60" />
                          )}
                        </button>
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((row, index) => {
                  const id = String(row[entity.idKey]);
                  const name = String(row[entity.labelKey] || id);
                  return (
                    <tr key={id} className="hover:bg-[#effaf9]">
                      <td
                        data-record-frozen={certificateFrozenColumn(entity.key, "number")}
                        data-frozen={
                          entity.key === "kalibrasi-alat" ? "number" : undefined
                        }
                        className="tnum px-4 py-3 text-muted-foreground"
                      >
                        {index + 1}
                      </td>
                      {mayBulk && (
                        <td className="px-2 py-3" data-record-frozen={certificateFrozenColumn(entity.key, "selection")}>
                          <input
                            aria-label={`Pilih ${name}`}
                            type="checkbox"
                            checked={selected.includes(id)}
                            disabled={!writable(row)}
                            onChange={(event) =>
                              setSelected((current) =>
                                event.target.checked
                                  ? [...current, id]
                                  : current.filter((key) => key !== id),
                              )
                            }
                            className="size-3.5 accent-[#16845a]"
                          />
                        </td>
                      )}
                      {displayColumns.map((column) => (
                        <td
                          key={column}
                          data-record-frozen={certificateFrozenColumn(entity.key, column)}
                          data-frozen={
                            entity.key === "kalibrasi-alat" &&
                            ["name", "tag"].includes(column)
                              ? column
                              : undefined
                          }
                          className={`whitespace-nowrap px-4 py-3 align-middle font-medium${entity.key === "kalibrasi-alat" && centeredCalibrationColumns.has(column) ? " text-center" : ""}`}
                        >
                          {column === detailColumn && entity.detail ? (
                            <Link
                              className="font-semibold text-primary-hover hover:underline"
                              href={`${entity.detail}/${id}?branch=${branch}`}
                            >
                              {valueFor(row, column)}
                            </Link>
                          ) : column === detailColumn ? (
                            <button type="button" className="text-left font-semibold text-primary-hover hover:underline" aria-label={`Lihat ${name}`} onClick={() => setViewing(row)}>{valueFor(row, column)}</button>
                          ) : (
                            valueFor(row, column)
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
              {entity.key === "kalibrasi-alat" && (
                <tfoot>
                  <tr>
                    <td colSpan={monitoringColumns.length + 1}>
                      <div className="sticky left-0 w-fit px-4">
                        <ScrollLoader
                          hasMore={data.rows.length < data.total}
                          busy={scrolling.busy}
                          error={scrolling.error}
                          load={scrolling.load}
                        />
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          <EmptyState
            filtered={
              !!(
                params.get("q") ||
                params.get("active") ||
                params.get("filter")
              )
            }
          />
        )}
        <div className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
          <p>
            {data.rows.length} dari {data.total} rekaman
          </p>
          {entity.key !== "kalibrasi-alat" && (
            <ScrollLoader
              hasMore={data.rows.length < data.total}
              busy={scrolling.busy}
              error={scrolling.error}
              load={scrolling.load}
            />
          )}
        </div>
      </Card>
      <Modal
        size="large"
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={`${editing === "new" ? "Tambah" : "Ubah"} ${entity.singular.toLowerCase()}`}
        description={entity.description}
      >
        {editing && (
          <RecordForm
            key={editing === "new" ? "new" : String(editing[entity.idKey])}
            entity={entity}
            branch={branch}
            row={editing === "new" ? undefined : editing}
            parent={parent}
            userId={userId}
            isAdmin={isAdmin}
            canManagePasswords={canManagePasswords}
            canManageDirectory={canManageDirectory}
            onSaved={() => setEditing(null)}
          />
        )}
      </Modal>
      <Modal
        size="large"
        open={!!viewing}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
        title={`Detail ${entity.singular.toLowerCase()}`}
        footer={viewing && <>
          {writable(viewing) && <>
            <Button variant="outline" disabled={protectedRecord(viewing)} onClick={() => { setEditing(viewing); setViewing(null); }}><Pencil/>Ubah data</Button>
            {entity.key === "pegawai" && canManageDirectory && <DirectoryActionsDialog row={viewing} branch={branch}/>}
            {entity.key === "pegawai" ? <EmployeeStatusDialog branch={branch} employee={String(viewing[entity.idKey])} version={Number(viewing.employment_status_version)} name={String(viewing[entity.labelKey])} status={String(viewing.employment_status)}/> :
              typeof viewing.is_active === "boolean" && <Button variant="outline" disabled={protectedRecord(viewing)} onClick={() => beginChange([String(viewing[entity.idKey])], !viewing.is_active)}><Power/>{viewing.is_active ? "Nonaktifkan" : "Aktifkan"}</Button>}
          </>}
          <Button variant="outline" onClick={() => setViewing(null)}>Tutup</Button>
        </>}
      >
        {viewing && (
          <dl className="grid gap-4 text-xs sm:grid-cols-2">
            {Object.entries(viewing).map(([key, value]) => (
              <div key={key} className="min-w-0">
                <dt className="mb-1 font-semibold text-muted-foreground">
                  {labelFor(key)}
                </dt>
                <dd className="whitespace-pre-wrap break-words leading-6 [overflow-wrap:anywhere]">
                  {typeof value === "object" && value !== null ? (
                    <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-[11px]">
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  ) : (
                    valueFor(viewing, key)
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>
      <ConfirmDialog
        open={!!change}
        onOpenChange={(open) => {
          if (!open) setChange(null);
        }}
        title={entity.key === "kalibrasi-alat" ? change?.active ? "Pulihkan alat?" : "Hapus alat ke Arsip?" : change?.active ? "Aktifkan rekaman?" : "Nonaktifkan rekaman?"}
        confirmLabel={entity.key === "kalibrasi-alat" ? change?.active ? "Pulihkan alat" : "Hapus ke Arsip" : undefined}
        destructive={entity.key === "kalibrasi-alat" && !change?.active}
        pending={busy}
        error={error}
        onConfirm={async () => {
          if (!change) return;
          setBusy(true);
          setFailure(undefined);
          try {
            const result = await setRecordsActive(
              { entity: entity.key, branch },
              change.ids,
              change.active,
              reason,
            );
            if (!result.ok) {
              setFailure(result.error);
              return;
            }
            notify(result.message);
            setChange(null);
            setSelected([]);
            router.refresh();
          } catch {
            setFailure(
              "Status belum dapat diperbarui. Muat ulang untuk memeriksa status aktual.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {entity.key === "kalibrasi-alat" ? <p>{change?.active ? "Alat kembali ke daftar aktif dan monitoring." : "Alat dipindahkan ke Arsip dan dikeluarkan dari monitoring aktif. Riwayat kalibrasi, dokumen, dan pengajuan UMA tetap tersimpan. Buka Arsip alat untuk memulihkannya."}</p> : <p>
          Perubahan berlaku pada {change?.ids.length} rekaman yang dipilih. Data
          dan riwayat tetap dipertahankan. Penonaktifan akun, peran, pegawai,
          atau cabang dapat langsung menutup akses terkait.
        </p>}
        {entity.key === "penugasan-peran" && (
          <label className="mt-4 block text-xs font-semibold">
            Alasan perubahan
            <Input
              className="mt-2"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={8}
              maxLength={1000}
            />
          </label>
        )}
      </ConfirmDialog>
    </>
  );
}
