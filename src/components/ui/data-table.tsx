"use client";
import { useState } from "react";
import { DeadlineDate } from "./deadline-date";
import { operationalValidity, remainingDays } from "@/lib/domain/validity";
import { ScrollLoader } from "./scroll-loader";
import { useScrollRecords } from "@/features/master-data/use-scroll-records";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  Pencil,
  Plus,
  Power,
} from "lucide-react";
import { Card } from "./card";
import { Button } from "./button";
import { Input } from "./input";
import { StatusBadge } from "./status-badge";
import { EmptyState } from "./empty-state";
import { Modal, ConfirmDialog } from "./modal";
import { useToast } from "./toast";
import { FilterBar } from "@/features/master-data/filter-bar";
import { RENEWAL_STATUSES } from "@/features/workflows/model";
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
  days_remaining: "Sisa hari",
  npp: "NPP",
  work_area_name: "Wilayah",
  account_manager_name: "Account Manager (AM)",
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
  function writable(row: DataRow) {
    return (
      canWrite &&
      (!["pelanggan", "sertifikat-klien"].includes(entity.key) ||
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
        : entity.columns;
  const mayBulk =
    canWrite &&
    ![
      "pengguna",
      "penugasan-peran",
      "penugasan",
      "cabang",
      "kalibrasi-alat",
    ].includes(entity.key);
  function navigate(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    Object.entries(values).forEach(([key, value]) => next.set(key, value));
    router.replace(`${path}?${next}`, { scroll: false });
  }
  const labelFor = (field: string) =>
    (entity.key === "sertifikat-klien" && field === "client_name"
      ? "Pelanggan & wilayah"
      : null) ||
    entity.fields.find((item) => item.key === field)?.label ||
    extraLabels[field] ||
    field;
  function valueFor(row: DataRow, column: string) {
    if (column === "notes") return businessNotes(row.notes) || "—";
    if (entity.key === "kompetensi-personil" && column === "original_title")
      return (
        <span className="block max-w-72 whitespace-normal">
          {String(row[column] || "—")}
          {row.renewal_process_status ? (
            <span
              className={
                "mt-1 block w-fit rounded-md px-2 py-1 text-[10px] font-medium " +
                (row.renewal_process_status === "renewed"
                  ? "bg-emerald-50 text-emerald-900"
                  : row.renewal_process_status === "processing"
                    ? "bg-blue-50 text-blue-900"
                    : "bg-slate-100 text-slate-700")
              }
            >
              {
                RENEWAL_STATUSES[
                  row.renewal_process_status as keyof typeof RENEWAL_STATUSES
                ]
              }
            </span>
          ) : null}
        </span>
      );
    if (column === "npp" && !row.npp) return "Non-NPP";
    if (entity.key === "kalibrasi-alat") {
      const raw = monitoringValue(row, column);
      const days = remainingDays(String(row.latest_due_date || ""));
      if (column === "due_date" || column === "latest_due_date")
        return <DeadlineDate value={raw} />;
      const display =
        column.endsWith("_date") && /^\d{4}-\d{2}-\d{2}$/.test(raw)
          ? formatBusinessDate(raw)
          : raw;
      return (
        <span
          className="block min-w-20 max-w-64 whitespace-pre-wrap break-words"
          title={display}
        >
          {display || "—"}
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
    return (
      <span className="block max-w-64 truncate" title={display}>
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
              dan filter
            </p>
          </div>
          {canWrite && entity.create !== false && (
            <Button onClick={() => setEditing("new")}>
              <Plus />
              Tambah {entity.singular.toLowerCase()}
            </Button>
          )}
        </div>
        {!hideFilters &&
          !["kompetensi-personil", "kalibrasi-alat"].includes(entity.key) && (
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
              Nonaktifkan pilihan
            </Button>
          </div>
        )}
        {data.rows.length ? (
          <div
            role="region"
            aria-label={`Tabel ${entity.title}`}
            tabIndex={0}
            className="max-w-full overflow-x-auto"
          >
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
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
                          className="min-w-16 border border-border px-2 py-2 text-center normal-case tracking-normal"
                        >
                          {label}
                        </th>
                      ))}
                      {index === 0 && (
                        <th rowSpan={3} scope="col" className="px-3">
                          Tindakan
                        </th>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <th className="w-10 px-4 py-3" scope="col">
                      No.
                    </th>
                    {mayBulk && (
                      <th className="w-8 px-2 py-3" scope="col">
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
                        aria-sort={
                          data.sort === column
                            ? data.dir === "asc"
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
                                data.sort === column && data.dir === "asc"
                                  ? "desc"
                                  : "asc",
                              page: "1",
                            })
                          }
                          className="inline-flex items-center gap-1.5"
                        >
                          {labelFor(column)}
                          {data.sort === column ? (
                            data.dir === "asc" ? (
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
                    <th scope="col" className="px-4 py-3 text-right">
                      Tindakan
                    </th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((row, index) => {
                  const id = String(row[entity.idKey]);
                  const name = String(row[entity.labelKey] || id);
                  const own =
                    (entity.key === "pengguna" && id === userId) ||
                    (entity.key === "penugasan-peran" &&
                      row.profile_id === userId) ||
                    (entity.key === "penugasan" &&
                      !isAdmin &&
                      row.assignment_type !== "personnel");
                  return (
                    <tr key={id} className="hover:bg-surface-muted">
                      <td className="tnum px-4 py-3 text-muted-foreground">
                        {index + 1}
                      </td>
                      {mayBulk && (
                        <td className="px-2 py-3">
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
                          className="whitespace-nowrap px-4 py-3 font-medium"
                        >
                          {column ===
                            (entity.detailColumn || entity.columns[0]) &&
                          entity.detail ? (
                            <Link
                              className="font-semibold text-primary-hover hover:underline"
                              href={`${entity.detail}/${id}?branch=${branch}`}
                            >
                              {valueFor(row, column)}
                            </Link>
                          ) : (
                            valueFor(row, column)
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Lihat ${name}`}
                            onClick={() =>
                              entity.detail
                                ? router.push(
                                    `${entity.detail}/${id}?branch=${branch}`,
                                    { scroll: false },
                                  )
                                : setViewing(row)
                            }
                          >
                            <Eye size={15} />
                          </Button>
                          {writable(row) && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={`Ubah ${name}`}
                                disabled={own}
                                onClick={() => setEditing(row)}
                              >
                                <Pencil size={15} />
                              </Button>
                              {typeof row.is_active === "boolean" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label={`${row.is_active ? "Nonaktifkan" : "Aktifkan"} ${name}`}
                                  disabled={own}
                                  onClick={() =>
                                    beginChange([id], !row.is_active)
                                  }
                                >
                                  <Power size={15} />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
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
          <ScrollLoader
            hasMore={data.rows.length < data.total}
            busy={scrolling.busy}
            error={scrolling.error}
            load={scrolling.load}
          />
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
      >
        {viewing && (
          <dl className="grid gap-4 text-xs sm:grid-cols-2">
            {Object.entries(viewing).map(([key, value]) => (
              <div key={key} className="min-w-0">
                <dt className="mb-1 font-semibold text-muted-foreground">
                  {labelFor(key)}
                </dt>
                <dd className="break-words leading-6">
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
        title={change?.active ? "Aktifkan rekaman?" : "Nonaktifkan rekaman?"}
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
        <p>
          Perubahan berlaku pada {change?.ids.length} rekaman yang dipilih. Data
          dan riwayat tetap dipertahankan. Penonaktifan akun, peran, pegawai,
          atau cabang dapat langsung menutup akses terkait.
        </p>
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
