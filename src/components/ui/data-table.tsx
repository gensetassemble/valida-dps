"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
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
import { RecordForm } from "@/features/master-data/record-form";
import { setRecordsActive } from "@/features/master-data/actions";
import type { EntityConfig } from "@/features/master-data/registry";
import type { DataRow } from "@/features/master-data/server";
import { formatBusinessDate, formatTimestamp } from "@/lib/format";
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
  updated_at: "Diperbarui",
  granted_at: "Diberikan",
  revoked_at: "Dicabut",
  table_name: "Tabel",
  record_id: "ID rekaman",
  action: "Perubahan",
  actor_id: "Aktor",
  occurred_at: "Waktu (WITA)",
};
export function DataTable({
  entity,
  branch,
  data,
  canWrite,
  userId,
  isAdmin,
  parent,
}: {
  entity: EntityConfig;
  branch: string;
  data: TableData;
  canWrite: boolean;
  userId: string;
  isAdmin: boolean;
  parent?: { field: string; id: string };
}) {
  const [editing, setEditing] = useState<DataRow | "new" | null>(null);
  const [viewing, setViewing] = useState<DataRow | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
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
  const pages = Math.max(1, Math.ceil(data.total / data.size));
  const mayBulk =
    canWrite &&
    !["pengguna", "penugasan-peran", "penugasan", "cabang"].includes(
      entity.key,
    );
  function navigate(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    Object.entries(values).forEach(([key, value]) => next.set(key, value));
    router.push(`${path}?${next}`);
  }
  const labelFor = (field: string) =>
    entity.fields.find((item) => item.key === field)?.label ||
    extraLabels[field] ||
    field;
  function valueFor(row: DataRow, column: string) {
    const value = row[column];
    if (value === null || value === undefined || value === "")
      return <span className="text-muted-foreground">—</span>;
    if (typeof value === "boolean" || column.endsWith("_status"))
      return (
        <StatusBadge
          value={typeof value === "boolean" ? value : String(value)}
        />
      );
    if (column.endsWith("_at")) return formatTimestamp(String(value));
    if (column.endsWith("_from") || column.endsWith("_until"))
      return formatBusinessDate(String(value));
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
        <FilterBar entity={entity} />
        {selected.length > 0 && mayBulk && (
          <div className="flex items-center justify-between gap-3 bg-emerald-50 px-4 py-3 text-xs">
            <span>{selected.length} rekaman dipilih pada halaman ini.</span>
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
                <tr>
                  <th className="w-10 px-4 py-3" scope="col">
                    No.
                  </th>
                  {mayBulk && (
                    <th className="w-8 px-2 py-3" scope="col">
                      <input
                        type="checkbox"
                        aria-label="Pilih semua pada halaman"
                        checked={
                          data.rows.length > 0 &&
                          selected.length === data.rows.length
                        }
                        onChange={(event) =>
                          setSelected(
                            event.target.checked
                              ? data.rows.map((row) =>
                                  String(row[entity.idKey]),
                                )
                              : [],
                          )
                        }
                        className="size-3.5 accent-[#16845a]"
                      />
                    </th>
                  )}
                  {entity.columns.map((column) => (
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
                        {(data.page - 1) * data.size + index + 1}
                      </td>
                      {mayBulk && (
                        <td className="px-2 py-3">
                          <input
                            aria-label={`Pilih ${name}`}
                            type="checkbox"
                            checked={selected.includes(id)}
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
                      {entity.columns.map((column) => (
                        <td
                          key={column}
                          className="whitespace-nowrap px-4 py-3 font-medium"
                        >
                          {column === entity.columns[0] && entity.detail ? (
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
                            onClick={() => setViewing(row)}
                          >
                            <Eye size={15} />
                          </Button>
                          {canWrite && (
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
          <p className="tnum">
            {data.total
              ? `${(data.page - 1) * data.size + 1}–${Math.min(data.page * data.size, data.total)}`
              : "0"}{" "}
            dari {data.total} rekaman
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={data.page <= 1}
              onClick={() => navigate({ page: String(data.page - 1) })}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="tnum">
              Halaman {data.page} / {pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={data.page >= pages}
              onClick={() => navigate({ page: String(data.page + 1) })}
              aria-label="Halaman berikutnya"
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </Card>
      <Modal
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
            onSaved={() => setEditing(null)}
          />
        )}
      </Modal>
      <Modal
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
