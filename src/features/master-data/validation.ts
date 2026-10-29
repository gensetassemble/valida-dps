import { z } from "zod";
import type { EntityConfig, Field } from "./registry";
import { ALL_ROLES } from "@/lib/auth/permissions";
import { driveFolder, addMonths, validDate } from "@/lib/domain/validity";
const emptyToNull = (value: unknown) =>
  typeof value === "string" && !value.trim() ? null : value;
function fieldSchema(field: Field) {
  if (field.kind === "money")
    return z.preprocess(
      emptyToNull,
      z
        .string()
        .regex(
          /^\d{1,18}(\.\d{1,2})?$/,
          "Gunakan rupiah tanpa pemisah ribuan, maksimum dua desimal.",
        )
        .nullable(),
    );
  if (field.kind === "url")
    return z.preprocess(
      emptyToNull,
      z
        .string()
        .refine(
          (v) => !!driveFolder(v),
          "Gunakan URL folder HTTPS drive.google.com.",
        )
        .nullable(),
    );
  if (field.kind === "boolean") return z.boolean();
  if (field.kind === "integer")
    return z.preprocess(
      emptyToNull,
      z
        .union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
        .pipe(z.number().int().min(1).max(600))
        .nullable(),
    );
  if (field.kind === "days")
    return z
      .union([
        z
          .string()
          .regex(/^\s*\d+(\s*,\s*\d+)*\s*$/)
          .transform((value) => value.split(",").map(Number)),
        z.array(z.number()),
      ])
      .pipe(z.array(z.number().int().min(0).max(3650)).min(1).max(16))
      .refine(
        (days) => new Set(days).size === days.length,
        "Hari pengingat tidak boleh berulang.",
      );
  let schema: z.ZodType = z
    .string()
    .trim()
    .max(field.max ?? (field.kind === "textarea" ? 2000 : 254));
  if (field.kind === "email")
    schema = z.email("Alamat email tidak valid.").max(254);
  if (field.kind === "tel")
    schema = z
      .string()
      .regex(/^[+0-9(). -]{4,30}$/, "Nomor telepon tidak valid.");
  if (field.kind === "date") schema = z.iso.date("Tanggal tidak valid.");
  if (field.kind === "select")
    schema = z.enum(
      field.options!.map((option) => option.value) as [string, ...string[]],
    );
  if (field.kind === "lookup")
    schema =
      field.lookup === "roles"
        ? z.enum(ALL_ROLES)
        : z.uuid("ID pilihan tidak valid.");
  if (field.key === "id") schema = z.uuid("UUID akun Auth tidak valid.");
  if (field.required && field.kind === "text")
    schema = z
      .string()
      .trim()
      .min(
        field.key === "grant_reason" ? 8 : field.key === "code" ? 1 : 2,
        "Nilai terlalu singkat.",
      )
      .max(field.max ?? 200);
  if (field.required && field.kind === "textarea")
    schema = z
      .string()
      .trim()
      .min(field.key === "grant_reason" ? 8 : 2)
      .max(field.max ?? 2000);
  return field.required ? schema : z.preprocess(emptyToNull, schema.nullable());
}
export function recordSchema(entity: EntityConfig, editing = false) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of entity.fields) {
    if (editing && (field.key === entity.idKey || field.immutable)) continue;
    shape[field.key] = fieldSchema(field);
  }
  return z
    .object(shape)
    .strict()
    .superRefine((values, context) => {
      const base =
        values[
          values.calculation_base === "issue_date"
            ? "issue_date"
            : "calibration_date"
        ];
      const computed =
        entity.key === "riwayat-kalibrasi" &&
        typeof base === "string" &&
        validDate(base) &&
        typeof values.interval_months === "number" &&
        Number.isInteger(values.interval_months) &&
        values.interval_months > 0 &&
        values.interval_months <= 600
          ? addMonths(base, values.interval_months)
          : null;
      const fail = (path: string, message: string) =>
        context.addIssue({ code: "custom", path: [path], message });
      if (
        values.validity_kind === "lifetime" &&
        (values.expiry_date || values.interval_months)
      )
        fail(
          "expiry_date",
          "Rekaman seumur hidup tidak memiliki tanggal akhir atau interval.",
        );
      for (const [start, end] of [
        ["issue_date", "expiry_date"],
        ["calibration_date", "due_date"],
      ])
        if (
          typeof values[start] === "string" &&
          typeof values[end] === "string" &&
          values[end] < values[start]
        )
          fail(end, "Tanggal akhir tidak boleh mendahului tanggal awal.");
      if (values.ownership === "client" && !values.client_id)
        fail("client_id", "Pilih pelanggan pemilik alat.");
      if (values.ownership === "internal" && values.client_id)
        fail("client_id", "Alat internal tidak mempunyai pelanggan pemilik.");
      if (
        entity.key === "kompetensi-personil" &&
        values.verification_status === "verified" &&
        values.validity_kind === "term" &&
        !values.expiry_date
      )
        fail(
          "expiry_date",
          "Kompetensi berjangka terverifikasi memerlukan tanggal akhir.",
        );
      if (
        entity.key === "riwayat-kalibrasi" &&
        values.verification_status === "verified" &&
        (!values.result ||
          !(values.due_date || computed) ||
          !values.date_source ||
          values.date_basis === "unverified")
      )
        fail(
          "verification_status",
          "Verifikasi memerlukan hasil, tanggal akhir dan sumber tanggal yang diperiksa.",
        );
      if (
        typeof values.effective_from === "string" &&
        typeof values.effective_until === "string" &&
        values.effective_until < values.effective_from
      )
        context.addIssue({
          code: "custom",
          message: "Tanggal akhir tidak boleh mendahului tanggal awal.",
          path: ["effective_until"],
        });
    });
}
export const requestScopeSchema = z
  .object({
    entity: z.string().min(1).max(50),
    branch: z.string().regex(/^[A-Z0-9]{2,8}$/),
    id: z.string().max(100).optional(),
  })
  .strict();
export function safeSearch(value: string) {
  return value
    .slice(0, 100)
    .replace(/[^\p{L}\p{N}\s@._-]/gu, " ")
    .trim();
}
