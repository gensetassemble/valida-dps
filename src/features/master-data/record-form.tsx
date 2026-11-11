"use client";
import { Fragment, useEffect, useState } from "react";
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
import { createCompetencyType } from "./competency-type-actions";
import { createClientReference } from "./client-reference-actions";
import { SearchableLookup } from "./searchable-lookup";
import { ContractMoneyInput } from "./contract-money-input";
import { DirectoryActionsDialog } from "./directory-actions-dialog";
import { MeasurementGroupsInput } from "@/features/operations/measurement-groups-input";
import {
  measurementInputs,
  type MeasurementGroupInput,
} from "@/features/operations/measurement-groups";
import type { DataRow } from "./server";
import type { EntityConfig, Field } from "./registry";
import { addMonths, validDate } from "@/lib/domain/validity";
import { clientExpiry } from "@/features/operations/client-certificate";
import { ClientIntervalInput } from "@/features/operations/client-interval-input";
import { formatBusinessDate } from "@/lib/format";
import { IntervalInput } from "./interval-input";
import { ResponsibleCoordinator } from "@/features/workflows/responsible-coordinator";
import { businessNotes } from "@/features/operations/notes";
import { equipmentUnits, normalizeEquipmentUnit } from "@/features/operations/equipment-units";
import { calibrationLaboratories, normalizeCalibrationLaboratory } from "@/features/operations/calibration-laboratories";
import { initialCalibrationFields } from "@/features/operations/monitoring";
import {
  calibrationMark,
  pairedCalibrationField,
  oppositeCalibrationMark,
  calibrationChoice,
  calibrationChoiceValue,
  laboratoryForCalibrationChoice,
} from "@/features/operations/calibration-marks";
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
  const [lookupFailed, setLookupFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const canCreateType = !disabled && (
    (entity === "kompetensi-personil" && field.key === "certificate_type_id") ||
    (entity === "sertifikat-klien" && ["client_id", "certificate_type_id"].includes(field.key))
  );
  const createLabel = entity === "kompetensi-personil" ? "jenis kompetensi" : field.key === "client_id" ? "pelanggan" : "jenis sertifikat";
  const searchable = field.lookup === "portofolio" ||
    (entity === "kalibrasi-alat" && field.key === "responsible_employee_id") ||
    (entity === "pengguna" && field.key === "employee_id") ||
    (entity === "kompetensi-personil" && ["employee_id", "certificate_type_id"].includes(field.key)) ||
    (entity === "sertifikat-klien" && ["client_id", "certificate_type_id", "certificate_work_area_id"].includes(field.key));
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingType, setSavingType] = useState(false);
  const [createError, setCreateError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLookupFailed(false);
      setStatus("Memuat pilihan…");
      try {
        const params = new URLSearchParams({
          entity,
          field: field.key,
          branch,
          q,
        });
        if (disabled && value) {
          params.set("id", value);
          params.delete("q");
        }
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
          if (!selected.ok) throw new Error();
          const data = await selected.json();
          loaded = [...data.options, ...loaded];
        }
        setOptions(loaded);
        if (value && !loaded.some((option) => option.value === value))
          setLookupFailed(true);
        setStatus(
          loaded.length
            ? field.lookup === "wilayah" ? "Ketik nama provinsi atau kabupaten/kota untuk mencari seluruh katalog; maksimal 20 hasil ditampilkan." : "Maksimal 20 pilihan sesuai akses."
            : "Tidak ada pilihan yang dapat diakses.",
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setStatus("Pilihan belum dapat dimuat.");
          setOptions([]);
          setLookupFailed(true);
        }
        void error;
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [entity, field.key, field.lookup, branch, q, value, disabled, retry]);
  if (disabled)
    return (
      <div className="space-y-2">
        <Input id={field.key} readOnly className="bg-muted"
          value={options.find((option) => option.value === value)?.label || (value ? lookupFailed ? "Referensi belum dapat dimuat" : "Memuat nama…" : "—")} />
        {lookupFailed && <Button type="button" variant="outline" onClick={() => setRetry((attempt) => attempt + 1)}>Coba muat ulang</Button>}
      </div>
    );
  return (
    <div className="space-y-2">
      {searchable ? <SearchableLookup id={field.key} label={field.label} value={value}
        options={options} query={q} onQuery={setQuery} onChange={onChange} disabled={disabled} status={status} /> : <>
      {!disabled && (
        <Input
          value={q}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={field.lookup === "wilayah" ? "Cari provinsi atau kabupaten/kota…" : "Cari pilihan di server…"}
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
          <option value={value}>{lookupFailed ? "Referensi belum dapat dimuat" : "Memuat pilihan terpilih…"}</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="text-[10px] text-muted-foreground">{status}</p>
      {lookupFailed && <Button type="button" variant="outline" onClick={() => setRetry((attempt) => attempt + 1)}>Coba muat ulang</Button>}
      </>}
      {canCreateType && !creating && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setNewName(q.trim());
            setCreateError("");
            setCreating(true);
          }}
        >
          + Tambah {createLabel} baru
        </Button>
      )}
      {canCreateType && creating && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <label className="grid gap-1 text-xs font-medium">
            Nama {createLabel} baru
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              maxLength={160}
              disabled={savingType}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Disimpan ke direktori dan langsung dipilih pada formulir
            ini.
          </p>
          {createError && (
            <p role="alert" className="text-xs text-red-800">
              {createError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={savingType || newName.trim().length < 2}
              onClick={async () => {
                setSavingType(true);
                setCreateError("");
                try {
                  const result = entity === "sertifikat-klien" ? await createClientReference({branch, field:field.key, name:newName}) : await createCompetencyType({
                    branch,
                    name: newName,
                  });
                  if (result.error) setCreateError(result.error);
                  else if (result.option) {
                    setOptions((current) => [
                      result.option!,
                      ...current.filter(
                        (option) => option.value !== result.option!.value,
                      ),
                    ]);
                    onChange(result.option.value);
                    setQuery("");
                    setCreating(false);
                  }
                } catch {
                  setCreateError(
                    "Pilihan baru belum tersimpan. Silakan coba kembali.",
                  );
                } finally {
                  setSavingType(false);
                }
              }}
            >
              {savingType ? "Menyimpan…" : "Simpan & pilih"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingType}
              onClick={() => setCreating(false)}
            >
              Batal
            </Button>
          </div>
        </div>
      )}
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
  if (field.key === "is_test") return row?.is_test === true;
  const value = row?.[field.key];
  if (
    field.key === "notes" &&
    [
      "kalibrasi-alat",
      "riwayat-kalibrasi",
      "kompetensi-personil",
      "sertifikat-klien",
    ].includes(entity)
  )
    return businessNotes(value);
  if (field.kind === "boolean")
    return typeof value === "boolean"
      ? value
      : ["is_primary", "initial_enabled"].includes(field.key)
        ? false
        : !["pegawai", "pengguna"].includes(entity);
  if (entity === "kalibrasi-alat" && field.key === "unit" && typeof value === "string")
    return normalizeEquipmentUnit(value);
  if (["kalibrasi-alat", "riwayat-kalibrasi"].includes(entity) && ["laboratory", "initial_laboratory"].includes(field.key) && typeof value === "string")
    return normalizeCalibrationLaboratory(value);
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
  canManageDirectory = false,
  measurementDefaults,
  onSaved,
  onCreated,
}: {
  entity: EntityConfig;
  branch: string;
  row?: DataRow;
  parent?: { field: string; id: string };
  userId: string;
  isAdmin: boolean;
  canManagePasswords?: boolean;
  canManageDirectory?: boolean;
  measurementDefaults?: DataRow;
  onSaved: () => void;
  onCreated?: (id: string) => void;
}) {
  const editing = !!row;
  const initialEquipment = entity.key === "kalibrasi-alat" && !editing;
  const equipmentIdentity = entity.fields.filter((f) =>
    ["name", "portfolio_id"].includes(f.key),
  );
  const unsortedFields = (
    initialEquipment
      ? [
          ...equipmentIdentity,
          ...initialCalibrationFields,
          ...entity.fields.filter(
            (f) => !["name", "portfolio_id"].includes(f.key),
          ),
        ]
      : entity.key === "pegawai"
        ? entity.fields.filter(
            (f) => !["employment_status", "is_active"].includes(f.key),
          )
        : entity.fields
  ).map((field) =>
    entity.key === "penugasan" && !isAdmin && field.key === "assignment_type"
      ? {
          ...field,
          options: field.options?.filter(
            (option) => option.value === "personnel",
          ),
        }
      : field,
  );
  const identityKeys = [
    "name",
    "tag",
    "asset_id",
    "serial",
    "brand",
    "model",
    "portfolio_id",
    "responsible_employee_id",
    "unit",
    "location",
  ];
  const eventFieldRank = (key: string) => unsortedFields.findIndex((field) =>
    field.key === (key === "issue_date" ? "calibration_date" : key === "interval_months" ? "issue_date" : key === "due_date" ? "interval_months" : key),
  );
  const formFields =
    entity.key === "kalibrasi-alat"
      ? [...unsortedFields].sort((a, b) => {
          const rank = (f: Field) =>
            identityKeys.includes(f.key)
              ? identityKeys.indexOf(f.key)
              : f.key.startsWith("initial_")
                ? 100 +
                  initialCalibrationFields.findIndex((x) => x.key === f.key)
                : 50 + entity.fields.findIndex((x) => x.key === f.key);
          return rank(a) - rank(b);
        })
      : entity.key === "riwayat-kalibrasi"
        ? [...unsortedFields].sort((a, b) => eventFieldRank(a.key) - eventFieldRank(b.key))
        : unsortedFields;
  const editableFields = formFields.filter(
    (field) => !editing || (field.key !== entity.idKey && !field.immutable),
  );
  const defaults: Record<string, unknown> = Object.fromEntries(
    editableFields.map((field) => [
      field.key,
      parent?.field === field.key
        ? parent.id
        : field.key === "account_manager_id" && !row && isAdmin
          ? ""
          : initialValue(field, row, userId, entity.key),
    ]),
  );
  if (["kalibrasi-alat", "riwayat-kalibrasi"].includes(entity.key)) {
    for (const field of editableFields) {
      if (pairedCalibrationField(field.key)) {
        const value = calibrationMark(defaults[field.key]);
        defaults[field.key] = ["√", "-"].includes(value) ? value : "";
      }
    }
    const prefix = initialEquipment ? "initial_" : "";
    if (calibrationChoiceValue(defaults[prefix + "calibration_internal"], defaults[prefix + "calibration_external"]) === "√") {
      defaults[prefix + "laboratory"] = laboratoryForCalibrationChoice("√", defaults[prefix + "laboratory"]);
    }
    defaults.measurement_groups = measurementInputs(
      row ? { ...measurementDefaults, ...row } : measurementDefaults,
      entity.key === "kalibrasi-alat" || !row,
    );
    if (!row && entity.key === "riwayat-kalibrasi")
      defaults.measurement_groups = (
        defaults.measurement_groups as MeasurementGroupInput[]
      ).map((g) => ({
        measurement_range: g.measurement_range,
        correction_factor: "",
      }));
  }
  if (entity.key === "riwayat-kalibrasi" && row)
    defaults.measurement_revision = String(row.updated_at || "");
  if (entity.key === "riwayat-kalibrasi") defaults.calculation_base = "issue_date";
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
  const [overrideResponsible, setOverrideResponsible] = useState(false);
  const initialEnabled = useWatch({ control, name: "initial_enabled" });
  const calibrationInternal = useWatch({ control, name: initialEquipment ? "initial_calibration_internal" : "calibration_internal" });
  const calibrationExternal = useWatch({ control, name: initialEquipment ? "initial_calibration_external" : "calibration_external" });
  const internalLaboratory = calibrationChoiceValue(calibrationInternal, calibrationExternal) === "√";
  const portfolio = useWatch({ control, name: "portfolio_id" });
  const profileEmployee = useWatch({ control, name: "employee_id" });
  const calibrationDate = useWatch({
    control,
    name: initialEquipment ? "initial_calibration_date" : "calibration_date",
  });
  const issueDate = useWatch({ control, name: "issue_date" });
  const months = useWatch({
    control,
    name: initialEquipment ? "initial_interval_months" : "interval_months",
  });
  const intervalDays = useWatch({ control, name: "interval_days" });
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
    entity.key === "sertifikat-klien"
      ? clientExpiry(String(baseDate || ""), months, intervalDays)
      : typeof baseDate === "string" &&
    validDate(baseDate) &&
    Number.isInteger(Number(months)) &&
    Number(months) > 0 &&
    Number(months) <= 600
      ? addMonths(baseDate, Number(months))
      : null;
  const [automaticEnd, setAutomaticEnd] = useState(() => {
    if (entity.key === "riwayat-kalibrasi") return true;
    if (!editing || !endField || !row?.[endField]) return true;
    const base = String(
      row[
        ["sertifikat-klien", "kompetensi-personil"].includes(entity.key) ||
        row.calculation_base === "issue_date"
          ? "issue_date"
          : "calibration_date"
      ] || "",
    );
    if (entity.key === "sertifikat-klien")
      return clientExpiry(base, row.interval_months, row.interval_days) === row[endField];
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
      // The report derives its interval from interval_months; no second manual value.
      const payload = initialEquipment
        ? { ...values, initial_interval_label: "" }
        : entity.key === "riwayat-kalibrasi"
          ? { ...values, interval_label: "" }
          : values;
      const result = await saveRecord(
        {
          entity: entity.key,
          branch,
          ...(editing ? { id: String(row![entity.idKey]) } : {}),
        },
        payload,
      );
      if (!result.ok) {
        setFailure(result.error);
        for (const [field, message] of Object.entries(result.fields || {}))
          setError(field, { message });
        return;
      }
      notify(result.message);
      if (!editing && result.id && onCreated) onCreated(result.id);
      else onSaved();
      if (entity.key === "pengguna" && !editing && result.id)
        router.push(`/pengaturan/pengguna/${result.id}?branch=${branch}`);
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
          Cabang <strong className="text-brand-navy">{branch}</strong>
        </div>
        {entity.key === "riwayat-kalibrasi" && (
          <Controller
            control={control}
            name="measurement_groups"
            render={({ field: input }) => (
              <MeasurementGroupsInput
                value={input.value as MeasurementGroupInput[]}
                onChange={input.onChange}
                branch={branch}
                factors
                error={
                  errors.measurement_groups
                    ? "Periksa rentang ukur dan faktor koreksi setiap kelompok."
                    : undefined
                }
              />
            )}
          />
        )}
        {endField && entity.key !== "riwayat-kalibrasi" && !lifetime && (!initialEquipment || !!initialEnabled) && (
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
              ? "equipment-entry grid overflow-hidden rounded-lg border border-border md:grid-cols-2"
              : "grid gap-4 sm:grid-cols-2"
          }
        >
          {entity.key === "kalibrasi-alat" && (
            <div
              role="row"
              className="hidden border-b border-border bg-slate-50 p-2 text-xs font-bold sm:block md:col-span-2"
            >
              <span role="columnheader">
                Identitas peralatan · Parameter / Isian
              </span>
            </div>
          )}
          {formFields.map((field) => {
            if (entity.key === "riwayat-kalibrasi" && ["calibration_date", "calculation_base", "reported_due_date", "date_basis", "date_source", "resolution_note"].includes(field.key)) return null;
            if (["kalibrasi-alat", "riwayat-kalibrasi"].includes(entity.key) && ["interval_label", "initial_interval_label"].includes(field.key)) return null;
            const markChoice = calibrationChoice(field.key);
            if (pairedCalibrationField(field.key) && !markChoice) return null;
            if (entity.key === "sertifikat-klien" && ["interval_days", "previous_certificate_id"].includes(field.key)) return null;
            if (
              (entity.key === "riwayat-kalibrasi" &&
                field.key === "correction_factor") ||
              (initialEquipment && field.key === "initial_correction_factor")
            )
              return null;
            if (
              entity.key === "kalibrasi-alat" &&
              field.key === "responsibility_override_reason" &&
              (!editing || !isAdmin || !overrideResponsible)
            )
              return null;
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
                  {field.kind === "lookup" ? <Lookup entity={entity.key} field={field} branch={branch}
                    value={String(row?.[field.key] ?? "")} onChange={() => {}} disabled /> : <Input
                    id={field.key}
                    value={String(row?.[field.key] ?? "")}
                    readOnly
                    className="bg-muted"
                  />}
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
                : field.hint && !markChoice
                  ? `${field.key}-hint`
                  : undefined,
            };
            return (
              <Fragment key={field.key}>
                {entity.key === "kalibrasi-alat" &&
                  ["color", "initial_enabled"].includes(field.key) && (
                    <div
                      role="row"
                      className="border-y border-border bg-slate-50 p-2 text-xs font-bold md:col-span-2"
                    >
                      {field.key === "color"
                        ? "Spesifikasi & kondisi"
                        : "Kalibrasi awal"}
                    </div>
                  )}
                <FormField
                  key={field.key}
                  layout={
                    entity.key === "kalibrasi-alat" ? "table" : "standard"
                  }
                  id={field.key}
                  label={entity.key === "riwayat-kalibrasi" && field.key === "due_date" ? "Tanggal berakhir" : entity.key === "riwayat-kalibrasi" && field.key === "issue_date" ? "Tanggal terbit sertifikat" : markChoice?.label ?? field.label}
                  hint={markChoice ? undefined : field.hint}
                  required={field.required}
                  error={message}
                  wide={field.key === "measurement_range"}
                >
                  {entity.key === "kalibrasi-alat" &&
                  field.key === "responsible_employee_id" &&
                  !overrideResponsible ? (
                    <>
                      <ResponsibleCoordinator
                        portfolio={String(portfolio || "")}
                        branch={branch}
                      />
                      {isAdmin && editing && (
                        <button
                          type="button"
                          onClick={() => setOverrideResponsible(true)}
                          className="text-[11px] underline"
                        >
                          Koreksi penanggung jawab dengan alasan
                        </button>
                      )}
                    </>
                  ) : field.key === "measurement_range" ? (
                    <Controller
                      control={control}
                      name="measurement_groups"
                      render={({ field: input }) => (
                        <MeasurementGroupsInput
                          value={input.value as MeasurementGroupInput[]}
                          branch={branch}
                          onChange={input.onChange}
                          factors={initialEquipment && !!initialEnabled}
                          error={
                            errors.measurement_groups
                              ? "Isi rentang ukur pada setiap kelompok."
                              : undefined
                          }
                        />
                      )}
                    />
                  ) : markChoice ? (
                    <Controller
                      control={control}
                      name={field.key}
                      render={({ field: input }) => (
                        <select
                          {...common}
                          name={input.name}
                          ref={input.ref}
                          onBlur={input.onBlur}
                          value={calibrationChoiceValue(input.value, getValues(pairedCalibrationField(field.key)!))}
                          onChange={(event) => {
                            input.onChange(event.target.value);
                            setValue(pairedCalibrationField(field.key)!, oppositeCalibrationMark(event.target.value), {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                            if (field.key.replace(/^initial_/, "") === "calibration_internal") {
                              const laboratoryKey = field.key.startsWith("initial_") ? "initial_laboratory" : "laboratory";
                              setValue(laboratoryKey, laboratoryForCalibrationChoice(event.target.value, getValues(laboratoryKey)), { shouldDirty: true, shouldValidate: true });
                            }
                          }}
                          className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"
                        >
                          <option value="" disabled>Pilih {markChoice.label.toLowerCase()}</option>
                          {markChoice.options.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      )}
                    />
                  ) : field.kind === "boolean" ? (
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
                  ) : entity.key === "pelanggan" && field.key === "account_manager_id" && locked && row?.account_manager_label ? (
                    <Input id={field.key} value={String(row.account_manager_label)} readOnly className="bg-muted"/>
                  ) : entity.key === "kalibrasi-alat" && field.key === "unit" ? (
                    <>
                      <Input {...common} {...register(field.key)} list="equipment-owner-units" maxLength={254} placeholder="Pilih subunit atau tulis lokasi lain" />
                      <datalist id="equipment-owner-units">{equipmentUnits.map((unit) => <option key={unit} value={unit} />)}</datalist>
                      <p className="mt-1 text-[10px] text-muted-foreground">UP Lombok dan TBBM Lombok dicatat terpisah. Detail ruangan/site dapat ditulis pada Lokasi.</p>
                    </>
                  ) : ["kalibrasi-alat", "riwayat-kalibrasi"].includes(entity.key) && ["laboratory", "initial_laboratory"].includes(field.key) ? (
                    <>
                      <Input {...common} {...register(field.key)} readOnly={internalLaboratory} list={internalLaboratory ? undefined : "calibration-laboratories"} maxLength={200} placeholder="Cari lembaga atau ketik nama baru" className={internalLaboratory ? "bg-muted" : undefined} />
                      <datalist id="calibration-laboratories">{calibrationLaboratories.map((name) => <option key={name} value={name} />)}</datalist>
                    </>
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
                          onChange={async value => {
                            input.onChange(value);
                            if (entity.key !== "pengguna" || field.key !== "employee_id" || !value) return;
                            try {
                              const response = await fetch("/api/master-data/lookups?" + new URLSearchParams({entity: "pengguna", field: "employee_id", branch, id: value}));
                              if (!response.ok) throw Error();
                              const option = (await response.json()).options.find((o: {value:string}) => o.value === value);
                              if (!option) throw Error();
                              if (getValues("employee_id") !== value) return;
                              setValue("full_name", option.full_name, {shouldDirty:true,shouldValidate:true});
                              setValue("npp", option.npp || "", {shouldDirty:true,shouldValidate:true});
                            } catch { setFailure("Identitas pegawai belum dapat dimuat. Pilih kembali nama pegawai."); }
                          }}
                          disabled={locked}
                        />
                      )}
                    />
                  ) : entity.key === "sertifikat-klien" && field.key === "interval_months" ? (
                    <ClientIntervalInput months={months} days={intervalDays}
                      onChange={(m,d) => { setValue("interval_months",m,{shouldDirty:true,shouldValidate:true}); setValue("interval_days",d,{shouldDirty:true,shouldValidate:true}); }} />
                  ) : field.kind === "money" ? (
                    <Controller control={control} name={field.key} render={({field:input}) => (
                      <ContractMoneyInput id={field.key} value={input.value} onChange={input.onChange} invalid={!!message}/>
                    )}/>
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
                      {...register(field.key, {
                        onChange: (event) => {
                          const pair = pairedCalibrationField(field.key);
                          if (pair)
                            setValue(
                              pair,
                              oppositeCalibrationMark(event.target.value),
                              { shouldDirty: true, shouldValidate: true },
                            );
                        },
                      })}
                      className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"
                    >
                      {pairedCalibrationField(field.key) && (
                        <option value="" disabled>
                          Pilih Ya / Tidak
                        </option>
                      )}
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
                      readOnly={field.key === endField && automaticEnd || entity.key === "pengguna" && !!profileEmployee && ["full_name", "npp"].includes(field.key)}
                    />
                  )}
                </FormField>
              </Fragment>
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
            {entity.key === "riwayat-kalibrasi"
              ? ". Tanggal berakhir dihitung otomatis dari tanggal terbit sertifikat dan interval."
              : ". Tanggal ini digunakan bila tanggal akhir dikosongkan. Salin tanggal dokumen bila tersedia."}
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
        <div className="valida-modal-actions flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          {entity.key === "pegawai" && row && canManageDirectory && (
            <DirectoryActionsDialog
              row={row}
              branch={branch}
              onSaved={onSaved}
            />
          )}
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
