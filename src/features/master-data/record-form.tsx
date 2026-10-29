"use client";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { recordSchema } from "./validation";
import { saveRecord } from "./actions";
import type { DataRow } from "./server";
import type { EntityConfig, Field } from "./registry";
import { addMonths, validDate } from "@/lib/domain/validity";
import { formatBusinessDate } from "@/lib/format";
import { IntervalInput } from "./interval-input";
import {
  initialCalibrationFields,
  measurementKeys,
} from "@/features/operations/monitoring";
type Option = { value: string; label: string };
function Lookup({
  entity,
  field,
  branch,
  value,
  onChange,
  disabled,
}: {
  entity: string;
  field: Field;
  branch: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [q, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [status, setStatus] = useState("Memuat pilihan…");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          entity,
          field: field.key,
          branch,
          q,
        });
        const response = await fetch(`/api/master-data/lookups?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const result = await response.json();
        let loaded: Option[] = result.options;
        if (value && !loaded.some((option) => option.value === value)) {
          params.set("id", value);
          params.delete("q");
          const selected = await fetch(`/api/master-data/lookups?${params}`, {
            signal: controller.signal,
          });
          if (selected.ok) {
            const data = await selected.json();
            loaded = [...data.options, ...loaded];
          }
        }
        setOptions(loaded);
        setStatus(
          loaded.length
            ? "Maksimal 20 pilihan sesuai akses."
            : "Tidak ada pilihan yang dapat diakses.",
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setStatus("Pilihan belum dapat dimuat.");
          setOptions([]);
        }
        void error;
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [entity, field.key, branch, q, value]);
  return (
    <div className="space-y-2">
      {!disabled && (
        <Input
          value={q}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari pilihan di server…"
          aria-label={`Cari pilihan ${field.label}`}
          maxLength={100}
        />
      )}
      <select
        id={field.key}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={field.required}
        className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm disabled:bg-muted"
      >
        <option value="">Pilih {field.label.toLowerCase()}</option>
        {value && !options.some((option) => option.value === value) && (
          <option value={value}>{value}</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="text-[10px] text-muted-foreground">{status}</p>
    </div>
  );
}
function initialValue(
  field: Field,
  row: DataRow | undefined,
  userId: string,
  entity: string,
) {
  if (field.kind === "password") return "";
  const value = row?.[field.key];
  if (field.kind === "boolean")
    return typeof value === "boolean"
      ? value
      : field.key === "is_primary"
        ? false
        : !["pegawai", "pengguna"].includes(entity);
  if (value !== null && value !== undefined)
    return Array.isArray(value) ? value.join(",") : String(value);
  if (field.key === "reminder_days") return "90,60,30,0";
  if (field.key === "verification_status") return "pending";
  if (field.key === "employment_status") return "unknown";
  if (field.key === "validity_kind") return "term";
  if (field.key === "effective_from")
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  if (field.key === "account_manager_id") return userId;
  if (field.kind === "select" && field.required)
    return field.options?.[0]?.value || "";
  return "";
}
export function RecordForm({
  entity,
  branch,
  row,
  parent,
  userId,
  isAdmin,
  canManagePasswords = false,
  onSaved,
}: {
  entity: EntityConfig;
  branch: string;
  row?: DataRow;
  parent?: { field: string; id: string };
  userId: string;
  isAdmin: boolean;
  canManagePasswords?: boolean;
  onSaved: () => void;
}) {
  const editing = !!row;
  const multipleParameters =
    entity.key === "riwayat-kalibrasi" &&
    Array.isArray(row?.monitoring_measurements) &&
    row.monitoring_measurements.length > 1;
  const initialEquipment = entity.key === "kalibrasi-alat" && !editing;
  const equipmentIdentity = entity.fields.filter((f) =>
    ["name", "portfolio_id"].includes(f.key),
  );
  const formFields = (
    initialEquipment
      ? [
          ...equipmentIdentity,
          ...initialCalibrationFields,
          ...entity.fields.filter(
            (f) => !["name", "portfolio_id"].includes(f.key),
          ),
        ]
      : entity.fields
  ).map((field) =>
    entity.key === "penugasan" && !isAdmin && field.key === "assignment_type"
      ? {
          ...field,
          options: field.options?.filter(
            (option) => option.value === "personnel",
          ),
        }
      : multipleParameters &&
          (measurementKeys as readonly string[]).includes(field.key)
        ? { ...field, label: field.label + " (parameter 1)" }
        : field,
  );
  const editableFields = formFields.filter(
    (field) => !editing || (field.key !== entity.idKey && !field.immutable),
  );
  const defaults = Object.fromEntries(
    editableFields.map((field) => [
      field.key,
      parent?.field === field.key
        ? parent.id
        : field.key === "account_manager_id" && !row && isAdmin
          ? ""
          : initialValue(field, row, userId, entity.key),
    ]),
  );
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Record<string, unknown>>({
    defaultValues: defaults,
    resolver: zodResolver(recordSchema(entity, editing)),
  });
  const [error, setFailure] = useState<string>();
  const initialEnabled = useWatch({ control, name: "initial_enabled" });
  const calibrationDate = useWatch({
    control,
    name: initialEquipment ? "initial_calibration_date" : "calibration_date",
  });
  const issueDate = useWatch({ control, name: "issue_date" });
  const months = useWatch({
    control,
    name: initialEquipment ? "initial_interval_months" : "interval_months",
  });
  const calculationBase = useWatch({ control, name: "calculation_base" });
  const validityKind = useWatch({ control, name: "validity_kind" });
  const baseDate =
    ["sertifikat-klien", "kompetensi-personil"].includes(entity.key) ||
    calculationBase === "issue_date"
      ? issueDate
      : calibrationDate;
  const endField = initialEquipment
    ? "initial_due_date"
    : entity.key === "riwayat-kalibrasi"
      ? "due_date"
      : ["sertifikat-klien", "kompetensi-personil"].includes(entity.key)
        ? "expiry_date"
        : null;
  const lifetime =
    entity.key === "kompetensi-personil" && validityKind === "lifetime";
  const calculated =
    typeof baseDate === "string" &&
    validDate(baseDate) &&
    Number.isInteger(Number(months)) &&
    Number(months) > 0 &&
    Number(months) <= 600
      ? addMonths(baseDate, Number(months))
      : null;
  const [automaticEnd, setAutomaticEnd] = useState(() => {
    if (!editing || !endField || !row?.[endField]) return true;
    const base = String(
      row[
        ["sertifikat-klien", "kompetensi-personil"].includes(entity.key) ||
        row.calculation_base === "issue_date"
          ? "issue_date"
          : "calibration_date"
      ] || "",
    );
    return (
      validDate(base) &&
      Number(row.interval_months) > 0 &&
      Number(row.interval_months) <= 600 &&
      addMonths(base, Number(row.interval_months)) === row[endField]
    );
  });
  useEffect(() => {
    if (lifetime) {
      if (getValues("expiry_date")) setValue("expiry_date", "");
      if (getValues("interval_months")) setValue("interval_months", "");
      return;
    }
    if (
      automaticEnd &&
      endField &&
      calculated &&
      getValues(endField) !== calculated
    )
      setValue(endField, calculated, {
        shouldDirty: true,
        shouldValidate: true,
      });
  }, [automaticEnd, endField, calculated, lifetime, getValues, setValue]);
  const [confirm, setConfirm] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const notify = useToast();
  async function persist(values: Record<string, unknown>) {
    if (saving) return;
    setSaving(true);
    setFailure(undefined);
    try {
      const result = await saveRecord(
        {
          entity: entity.key,
          branch,
          ...(editing ? { id: String(row![entity.idKey]) } : {}),
        },
        values,
      );
      if (!result.ok) {
        setFailure(result.error);
        for (const [field, message] of Object.entries(result.fields || {}))
          setError(field, { message });
        return;
      }
      notify(result.message);
      onSaved();
      router.refresh();
    } catch {
      setFailure(
        "Perubahan ditolak atau layanan belum tersedia. Tidak ada keberhasilan penyimpanan yang dapat dikonfirmasi.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <form
        className="space-y-5"
        onSubmit={handleSubmit((values) => {
          if (["pengguna", "penugasan-peran"].includes(entity.key)) {
            setConfirm(values);
            return;
          }
          return persist(values);
        })}
      >
        <div className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-[11px] leading-5 text-muted-foreground">
          Cabang <strong className="text-brand-navy">{branch}</strong>.
          Perubahan dicatat pada audit. Identitas dan relasi induk tidak
          dipindahkan melalui formulir ubah.
        </div>
        {multipleParameters && (
          <p className="rounded-lg bg-slate-50 p-3 text-xs">
            Peristiwa ini memiliki beberapa parameter. Bidang bertanda parameter
            1 mengubah parameter pertama; parameter lainnya tetap tersimpan dan
            dapat dilihat pada detail peristiwa.
          </p>
        )}
        {endField && !lifetime && (!initialEquipment || !!initialEnabled) && (
          <label className="block max-w-sm space-y-1 text-xs font-semibold">
            Tanggal berakhir otomatis
            <select
              value={automaticEnd ? "true" : "false"}
              onChange={(e) => setAutomaticEnd(e.target.value === "true")}
              className="h-10 w-full rounded-lg border border-input bg-white px-3"
            >
              <option value="true">Ya — tanggal awal + interval</option>
              <option value="false">
                Tidak — gunakan tanggal pada dokumen
              </option>
            </select>
          </label>
        )}
        <div
          role={entity.key === "kalibrasi-alat" ? "table" : undefined}
          aria-label={
            entity.key === "kalibrasi-alat" ? "Parameter alat" : undefined
          }
          className={
            entity.key === "kalibrasi-alat"
              ? "overflow-hidden rounded-lg border border-border"
              : "grid gap-4 sm:grid-cols-2"
          }
        >
          {entity.key === "kalibrasi-alat" && (
            <div
              role="row"
              className="hidden grid-cols-[minmax(160px,0.35fr)_minmax(0,1fr)] gap-5 border-b border-border bg-slate-50 p-3 text-xs font-bold sm:grid"
            >
              <span role="columnheader">Parameter</span>
              <span role="columnheader">Isian</span>
            </div>
          )}
          {formFields.map((field) => {
            if (field.kind === "password" && !canManagePasswords) return null;
            if (
              lifetime &&
              ["interval_months", "expiry_date"].includes(field.key)
            )
              return null;
            if (
              initialEquipment &&
              field.key.startsWith("initial_") &&
              field.key !== "initial_enabled" &&
              !initialEnabled
            )
              return null;
            const immutable =
              editing && (field.key === entity.idKey || field.immutable);
            const locked =
              parent?.field === field.key ||
              (!isAdmin &&
                entity.key === "pelanggan" &&
                (field.key === "account_manager_id" ||
                  (editing && field.key === "portfolio_id")));
            if (immutable)
              return (
                <FormField
                  key={field.key}
                  layout={
                    entity.key === "kalibrasi-alat" ? "table" : "standard"
                  }
                  id={field.key}
                  label={field.label}
                  hint="Identitas/relasi tetap; buat penugasan baru bila diperlukan."
                >
                  <Input
                    id={field.key}
                    value={String(row?.[field.key] ?? "")}
                    readOnly
                    className="bg-muted"
                  />
                </FormField>
              );
            const message =
              typeof errors[field.key]?.message === "string"
                ? (errors[field.key]!.message as string)
                : undefined;
            const common = {
              id: field.key,
              "aria-invalid": !!message,
              "aria-describedby": message
                ? `${field.key}-error`
                : field.hint
                  ? `${field.key}-hint`
                  : undefined,
            };
            return (
              <FormField
                key={field.key}
                layout={entity.key === "kalibrasi-alat" ? "table" : "standard"}
                id={field.key}
                label={field.label}
                hint={field.hint}
                required={field.required}
                error={message}
              >
                {field.kind === "boolean" ? (
                  <Controller
                    control={control}
                    name={field.key}
                    render={({ field: input }) => (
                      <select
                        {...common}
                        value={input.value ? "true" : "false"}
                        onChange={(event) =>
                          input.onChange(event.target.value === "true")
                        }
                        className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"
                      >
                        <option value="true">
                          {field.key === "is_active" ? "Aktif" : "Ya"}
                        </option>
                        <option value="false">
                          {field.key === "is_active" ? "Nonaktif" : "Tidak"}
                        </option>
                      </select>
                    )}
                  />
                ) : field.kind === "lookup" ? (
                  <Controller
                    control={control}
                    name={field.key}
                    render={({ field: input }) => (
                      <Lookup
                        entity={entity.key}
                        field={field}
                        branch={branch}
                        value={String(input.value || "")}
                        onChange={input.onChange}
                        disabled={locked}
                      />
                    )}
                  />
                ) : field.kind === "integer" &&
                  /interval|validity_months/.test(field.key) ? (
                  <Controller
                    control={control}
                    name={field.key}
                    render={({ field: input }) => (
                      <IntervalInput
                        id={field.key}
                        value={input.value}
                        onChange={input.onChange}
                        invalid={!!message}
                        describedBy={common["aria-describedby"]}
                      />
                    )}
                  />
                ) : field.kind === "combobox" ? (
                  <>
                    <Input
                      {...common}
                      {...register(field.key)}
                      list={field.key + "-choices"}
                      maxLength={field.max || 200}
                    />
                    <datalist id={field.key + "-choices"}>
                      {field.options?.map((option) => (
                        <option value={option.value} key={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </datalist>
                  </>
                ) : field.kind === "select" ? (
                  <select
                    {...common}
                    {...register(field.key)}
                    className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"
                  >
                    {field.options!.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.kind === "textarea" ? (
                  <textarea
                    {...common}
                    {...register(field.key)}
                    maxLength={field.max || 2000}
                    className="min-h-24 w-full rounded-lg border border-input bg-white p-3 text-sm"
                  />
                ) : (
                  <Input
                    {...common}
                    type={
                      field.kind === "integer"
                        ? "number"
                        : field.kind === "date"
                          ? "date"
                          : field.kind === "password"
                            ? "password"
                            : field.kind === "email"
                              ? "email"
                              : field.kind === "tel"
                                ? "tel"
                                : "text"
                    }
                    {...register(field.key)}
                    autoComplete={
                      field.kind === "password" ? "new-password" : undefined
                    }
                    maxLength={field.max || 254}
                    onInput={
                      field.kind === "date"
                        ? (event) =>
                            setValue(field.key, event.currentTarget.value, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                        : undefined
                    }
                    readOnly={field.key === endField && automaticEnd}
                  />
                )}
              </FormField>
            );
          })}
        </div>
        {entity.key === "kalibrasi-alat" && editing && (
          <Link
            className="block text-xs font-semibold underline"
            href={"/kalibrasi-alat/" + String(row?.id) + "?branch=" + branch}
          >
            Kelola tanggal dan riwayat kalibrasi alat →
          </Link>
        )}
        {endField && !lifetime && (!initialEquipment || !!initialEnabled) && (
          <p className="rounded-lg border border-border bg-slate-50 p-3 text-xs">
            Tanggal hasil perhitungan kalender:{" "}
            <span className="block text-[11px] text-muted-foreground">
              {typeof baseDate === "string" && validDate(baseDate)
                ? formatBusinessDate(baseDate)
                : "Tanggal awal belum diisi"}{" "}
              + {String(months || "—")} bulan
            </span>
            <strong>
              {calculated
                ? formatBusinessDate(calculated)
                : "Pilih tanggal dasar dan interval positif."}
            </strong>
            . Tanggal ini digunakan bila tanggal akhir dikosongkan. Salin
            tanggal dokumen bila tersedia.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button
            variant="outline"
            type="button"
            onClick={onSaved}
            disabled={isSubmitting || saving}
          >
            Batal
          </Button>
          <Button type="submit" disabled={isSubmitting || saving}>
            {isSubmitting || saving ? "Menyimpan…" : "Simpan perubahan"}
          </Button>
        </div>
      </form>
      <Modal
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !saving) setConfirm(null);
        }}
        title="Konfirmasi pengaturan akses"
        description="Pastikan identitas, status aktivasi, penugasan peran, dan cabang telah disetujui organisasi."
      >
        <p className="mb-4 text-sm">
          {entity.key === "pengguna"
            ? "Perubahan identitas dan password berlaku segera. Akun baru belum memiliki peran sampai ditugaskan. Password kosong mempertahankan password lama. Tidak ada email yang dikirim."
            : "Perubahan akses berlaku segera dan dicatat pada audit."}
        </p>
        <Button
          disabled={saving}
          onClick={async () => {
            if (confirm) {
              await persist(confirm);
              setConfirm(null);
            }
          }}
        >
          {saving ? "Menyimpan…" : "Setujui dan simpan"}
        </Button>
      </Modal>
    </>
  );
}
