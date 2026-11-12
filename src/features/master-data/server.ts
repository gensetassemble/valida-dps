import "server-only";
import { personnelRow, personnelText } from "@/lib/personnel-text";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireActiveUser } from "@/lib/auth/guards";
import {
  hasPermission,
  activeBranch,
  canManageEmployeeDirectory,
} from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getEntity, type EntityConfig } from "./registry";
import { safeSearch } from "./validation";
import { personnelRenewalDisplay } from "@/features/workflows/model";
import { operationalOrder } from "@/features/operations/list-order";
import { portfolioIds } from "@/features/operations/equipment-export-scope";
import { calibrationExpiryReview } from "@/features/operations/calibration-expiry";
export type DataRow = Record<string, unknown>;

async function annotateCalibrationExpiry(db: Awaited<ReturnType<typeof masterClient>>, branch: string, rows: DataRow[]) {
  const ids = [...new Set(rows.map((row) => row.latest_calibration_id).filter((id): id is string => typeof id === "string"))];
  if (!ids.length) return;
  const { data, error } = await db.from("calibrations")
    .select("id,issue_date,calibration_date,interval_months,due_date,reported_due_date,resolution_note")
    .eq("branch_code", branch).in("id", ids);
  if (error) throw new Error("Status pemeriksaan tanggal belum dapat dimuat.");
  const reviews = new Map((data || []).map((row) => [row.id, calibrationExpiryReview(row)]));
  for (const row of rows) row.calibration_expiry_needs_review = reviews.get(String(row.latest_calibration_id))?.needsReview ?? false;
}
export type QueryParams = {
  q?: string;
  sort?: string;
  dir?: string;
  page?: string;
  active?: string;
  branch?: string;
  filter?: string;
  value?: string;
  validity?: string;
  from?: string;
  until?: string;
  client?: string;
  am?: string;
  marketing?: string;
  portfolio?: string;
  portfolios?: string;
  type?: string;
  area?: string;
  employee?: string;
  category?: string;
  examples?: string;
  kind?: string;
  eligibility?: string;
  archived?: string;
  renewal?: string;
  generation?: string;
  unit?: string;
};
export async function entityContext(
  key: string,
  requestedBranch?: string,
  writing = false,
) {
  const context = await requireActiveUser();
  const entity = getEntity(key,requestedBranch||context.profile.branch_code);
  if (!entity) throw new Error("Jenis data tidak tersedia.");
  const branch = activeBranch(
    context.scopes,
    context.profile.branch_code,
    requestedBranch,
  );
  const allowed = hasPermission(
    context.scopes,
    branch,
    writing ? entity.writeRoles : entity.readRoles,
  );
  if (!allowed || (writing && entity.readonly))
    throw new Error(
      "Anda tidak memiliki kewenangan pada data/cabang tersebut.",
    );
  return {
    ...context,
    entity,
    branch,
    canWrite:
      !entity.readonly &&
      hasPermission(context.scopes, branch, entity.writeRoles),
  };
}
// A single dynamic SDK boundary: table/columns are selected only from the server-owned registry;
// strict Zod schemas validate each mutation and RLS/constraints remain authoritative.
export async function masterClient(): Promise<SupabaseClient> {
  return await createClient();
}
export async function pageEntityContext(
  ...args: Parameters<typeof entityContext>
) {
  try {
    return await entityContext(...args);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Anda tidak memiliki")
    )
      return null;
    throw error;
  }
}
export function operationalFilterPairs(
  key: string,
  params: QueryParams,
): [string, string][] {
  if (
    ![
      "sertifikat-klien",
      "kompetensi-personil",
      "kalibrasi-alat",
      "riwayat-kalibrasi",
    ].includes(key)
  )
    return [];
  const pairs: [string, string][] = [];
  if (
    key === "kompetensi-personil" &&
    ["unprocessed", "processing", "renewed"].includes(params.renewal || "")
  )
    pairs.push(["renewal_status", params.renewal!]);
  if (
    key === "kompetensi-personil" &&
    ["term", "lifetime"].includes(params.kind || "")
  )
    pairs.push(["validity_kind", params.kind!]);
  if (
    key === "kalibrasi-alat" &&
    [
      "Layak Pakai",
      "Tidak Layak Pakai",
      "Hasil Belum Diisi",
      "Tanggal Belum Diisi",
      "Belum Ada Kalibrasi",
    ].includes(params.eligibility || "")
  )
    pairs.push(["eligibility_status", params.eligibility!]);
  if (
    params.validity &&
    [
      "Expired",
      "Kritis",
      "Perhatian",
      "Pantau",
      "Aman",
      "Tanggal Belum Diisi",
      "Berlaku Seumur Hidup",
    ].includes(params.validity)
  )
    pairs.push(["validity_status", params.validity]);
  const filters: Record<string, string> =
    key === "sertifikat-klien"
      ? {
          client: "client_id",
          am: "account_manager_id",
          marketing: "marketing_contact_id",
          portfolio: "scope_portfolio_id",
          type: "certificate_type_id",
          area: "work_area_id",
        }
      : key === "kompetensi-personil"
        ? { employee: "employee_id", type: "certificate_type_id" }
        : key === "kalibrasi-alat"
          ? { portfolio: "portfolio_id" }
          : {};
  for (const [param, column] of Object.entries(filters)) {
    const value = params[param as keyof QueryParams];
    if (value && /^[0-9a-f-]{36}$/i.test(value)) pairs.push([column, value]);
  }
  return pairs;
}
export async function listRecords(
  entity: EntityConfig,
  branch: string,
  params: QueryParams = {},
  parent?: { field: string; id: string },
  pageSize = 40,
) {
  const db = await masterClient();
  const page = Math.max(
    1,
    Math.min(100000, Math.floor(Number(params.page) || 1)),
  );
  const size = Math.max(1, Math.min(1000, pageSize));
  const ordering = operationalOrder(entity.key, params.sort, params.dir)
    ?? operationalOrder(entity.key,
      [...entity.columns, entity.idKey].includes(params.sort || "") ? params.sort : undefined,
      params.dir);
  const sort = ordering?.[0].column ?? ([...entity.columns, entity.idKey].includes(params.sort || "")
    ? params.sort!
    : entity.key === "kalibrasi-alat"
      ? "portfolio_code"
      : entity.key === "sertifikat-klien" ? "expiry_date" : entity.columns[0]);
  const archives = entity.key === "pegawai" && params.archived === "true";
  if (archives) {
    const context = await requireActiveUser();
    if (!canManageEmployeeDirectory(context.scopes, branch))
      throw Error("Arsip direktori hanya tersedia untuk IT Officer dan HRGA.");
  }
  let query = db
    .from(archives ? entity.table : entity.readTable || entity.table)
    .select("*", { count: "exact" });
  if (archives)
    query = query
      .not("archived_at", "is", null)
      .not("full_name", "ilike", "[CONTOH]%")
      .is("merged_into_employee_id", null);
  if (entity.key !== "roles")
    query = query.eq(entity.key === "cabang" ? "code" : "branch_code", branch);
  if (["sertifikat-klien", "pelanggan"].includes(entity.key))
    query = query.eq("is_example", false);
  const search = safeSearch(params.q || "");
  for (const term of search.split(/\s+/).filter(Boolean).slice(0, 8))
    query = query.or(
      entity.search.map((field) => `${field}.ilike.%${term}%`).join(","),
    );
  if (params.active === "true" || params.active === "false")
    query = query.eq("is_active", params.active === "true");
  else if (entity.key === "kalibrasi-alat") query = query.eq("is_active", true);
  const field = entity.fields.find(
    (field) => field.key === params.filter && field.kind === "select",
  );
  if (field && field.options?.some((option) => option.value === params.value))
    query = query.eq(field.key, params.value!);
  if (parent) query = query.eq(parent.field, parent.id);
  if (entity.key === "kalibrasi-alat" && params.unit && params.unit.length <= 254)
    query = params.unit === "__unset__" ? query.is("owner_unit", null) : query.eq("owner_unit", params.unit);
  if (["kompetensi-personil", "sertifikat-klien"].includes(entity.key)) {
    if (params.generation === "history")
      query = query.not("superseded_by_certificate_id", "is", null);
    else if (params.generation !== "all")
      query = query.is("superseded_by_certificate_id", null);
  }
  for (const [column, value] of operationalFilterPairs(entity.key, params))
    query = query.eq(column, value);
  if (entity.key === "kalibrasi-alat" && params.portfolios !== undefined)
    query = query.in("portfolio_id", portfolioIds(params.portfolios));
  if (
    entity.key === "kompetensi-personil" &&
    params.portfolio &&
    /^[0-9a-f-]{36}$/i.test(params.portfolio)
  )
    query = query.contains("portfolio_ids", [params.portfolio]);
  const dateColumn =
    entity.key === "kalibrasi-alat"
      ? "latest_due_date"
      : entity.key === "riwayat-kalibrasi"
        ? "due_date"
        : "expiry_date";
  if (
    entity.readTable &&
    params.from &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.from)
  )
    query = query.gte(dateColumn, params.from);
  if (
    entity.readTable &&
    params.until &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.until)
  )
    query = query.lte(dateColumn, params.until);
  for (const order of ordering ?? [{column: sort, ascending: params.dir !== "desc"}])
    query = query.order(order.column, { ascending: order.ascending, nullsFirst: false });
  if (!ordering && entity.key === "kalibrasi-alat" && sort !== "name")
    query = query.order("name");
  if (sort !== entity.idKey)
    query = query.order(entity.idKey, { ascending: true });
  const { data, count, error } = await query.range(
    (page - 1) * size,
    page * size - 1,
  );
  if (error) {
    console.error("Record query failed", {
      entity: entity.key,
      code: error.code,
      message: error.message?.slice(0, 160),
    });
    throw new Error(
      "Data belum dapat dimuat. Silakan coba kembali atau hubungi administrator.",
    );
  }
  const rows = ((data ?? []) as DataRow[]).map(personnelRow);
  if (entity.key === "kalibrasi-alat") await annotateCalibrationExpiry(db, branch, rows);
  if (entity.key === "kompetensi-personil" && rows.length) {
    for (const row of rows)
      row.renewal_process_status = personnelRenewalDisplay(
        String(row.renewal_status || "unprocessed"),
        String(row.validity_status || ""),
        row.validity_kind === "lifetime",
      );
  }
  for (const row of rows)
    if (typeof row.previous_order_value_text === "string")
      row.previous_order_value = row.previous_order_value_text;
  const labels: Record<string, Record<string, string>> = {};
  await Promise.all(
    entity.fields
      .filter((field) => field.kind === "lookup")
      .map(async (field) => {
        const target = getEntity(field.lookup!,branch);
        if (!target) return;
        const source = ({portfolio_id:"portfolio_code",employee_id:"employee_name",client_id:"client_name",certificate_type_id:"certificate_type_name",equipment_id:"equipment_name"} as Record<string,string>)[field.key];
        const known = Object.fromEntries(rows.filter(row => typeof row[field.key] === "string" && source && row[source]).map(row => [String(row[field.key]),
          ["pegawai","pengguna","koordinator","marketing"].includes(target.key) ? personnelText(row[source]) : String(row[source])
        ]));
        labels[field.key] = known;
        const ids = [
          ...new Set(
            rows
              .map((row) => row[field.key])
              .filter((value): value is string => typeof value === "string" && !Object.hasOwn(known,value)),
          ),
        ];
        if (!ids.length) return;
        const { data } = await db
          .from(target.table)
          .select(`${target.idKey},${target.labelKey}`)
          .in(target.idKey, ids)
          .limit(1000);
        const visible = (data || []) as unknown as DataRow[];
        labels[field.key] = { ...known, ...Object.fromEntries(
          visible.map((row) => [
            String(row[target.idKey]),
            ["pegawai", "pengguna", "koordinator", "marketing"].includes(target.key) ? personnelText(row[target.labelKey]) : String(row[target.labelKey] || row[target.idKey]),
          ]),
        ) };
      }),
  );
  if (entity.key === "pelanggan")
    labels.account_manager_id = Object.fromEntries(rows.filter(row=>row.account_manager_id).map(row=>[
      String(row.account_manager_id),String(row.account_manager_label || "Nama akun belum tersedia"),
    ]));
  return {
    rows,
    labels,
    total: count ?? 0,
    page,
    size,
    sort: sort === "owner_unit" ? "unit" : sort,
    dir: params.dir === "desc" ? "desc" : "asc",
  };
}
export async function getRecord(
  entity: EntityConfig,
  branch: string,
  id: string,
) {
  const db = await masterClient();
  let query = db
    .from(entity.readTable || entity.table)
    .select("*")
    .eq(entity.idKey, id);
  if (entity.key !== "roles")
    query = query.eq(entity.key === "cabang" ? "code" : "branch_code", branch);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("Detail data belum dapat dimuat.");
  if (data && entity.key === "kalibrasi-alat") {
    await annotateCalibrationExpiry(db, branch, [data]);
    const { data: ranges, error: rangesError } = await db
      .from("equipment")
      .select("measurement_ranges")
      .eq("id", id)
      .eq("branch_code", branch)
      .maybeSingle();
    if (rangesError) throw Error("Rentang ukur alat belum dapat dimuat.");
    data.measurement_ranges = ranges?.measurement_ranges;
  }
  if (data && typeof data.previous_order_value_text === "string")
    data.previous_order_value = data.previous_order_value_text;
  return data ? personnelRow(data as DataRow) : null;
}
export async function referenceLabels(
  entity: EntityConfig,
  branch: string,
  row: DataRow,
) {
  const db = await masterClient();
  const known: Record<string, unknown> = {
    portfolio_id: row.portfolio_code || row.portfolio_name,
    employee_id: row.employee_name,
    client_id: row.client_name,
    certificate_type_id: row.certificate_type_name,
    equipment_id: row.equipment_name,
    account_manager_id: entity.key === "pelanggan" ? row.account_manager_label : undefined,
    work_area_id: row.work_area_name,
  };
  return Object.fromEntries(
    await Promise.all(
      entity.fields
        .filter((f) => f.kind === "lookup" && row[f.key])
        .map(async (field) => {
          if (known[field.key]) return [field.key, String(known[field.key])];
          const target = getEntity(field.lookup!,branch);
          if (!target) return [field.key, "Referensi tidak tersedia"];
          let query = db
            .from(
              target.key === "pegawai"
                ? target.table
                : target.readTable || target.table,
            )
            .select(target.labelKey)
            .eq(target.idKey, String(row[field.key]));
          if (target.key !== "roles")
            query = query.eq(
              target.key === "cabang" ? "code" : "branch_code",
              branch,
            );
          const { data } = await query.maybeSingle();
          return [
            field.key,
            data
              ? String((data as unknown as DataRow)[target.labelKey])
              : "Referensi tidak tersedia",
          ];
        }),
    ),
  );
}
export function publicDatabaseError(code?: string) {
  if (code === "23505")
    return "Data dengan identitas/kontak utama tersebut sudah ada. Periksa kembali data aktif.";
  if (code === "23503")
    return "Relasi tidak valid, tidak sesuai cabang, atau akun Auth belum disediakan.";
  if (code === "23514")
    return "Data tidak memenuhi aturan verifikasi, aktivasi, tanggal, kategori, atau penugasan AM.";
  if (code === "42501")
    return "Perubahan ditolak. Periksa kewenangan, kepemilikan, dan relasi yang tidak boleh dipindahkan.";
  return "Perubahan belum tersimpan. Silakan coba kembali atau hubungi administrator.";
}
