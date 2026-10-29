import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireActiveUser } from "@/lib/auth/guards";
import { hasPermission, activeBranch } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getEntity, type EntityConfig } from "./registry";
import { safeSearch } from "./validation";
export type DataRow = Record<string, unknown>;
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
  portfolio?: string;
  type?: string;
  area?: string;
  employee?: string;
  category?: string;
  examples?: string;
  kind?: string;
  eligibility?: string;
};
export async function entityContext(
  key: string,
  requestedBranch?: string,
  writing = false,
) {
  const context = await requireActiveUser();
  const entity = getEntity(key);
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
    ["term", "lifetime"].includes(params.kind || "")
  )
    pairs.push(["validity_kind", params.kind!]);
  if (
    key === "kalibrasi-alat" &&
    [
      "Layak Pakai",
      "Tidak Layak Pakai",
      "Perlu Verifikasi",
      "Kalibrasi Terbaru Belum Diverifikasi",
    ].includes(params.eligibility || "")
  )
    pairs.push(["eligibility_status", params.eligibility!]);
  if (
    params.validity &&
    [
      "Kedaluwarsa",
      "Kritis",
      "Perhatian",
      "Pantau",
      "Aman",
      "Perlu Verifikasi",
      "Berlaku Seumur Hidup",
    ].includes(params.validity)
  )
    pairs.push(["validity_status", params.validity]);
  const filters: Record<string, string> =
    key === "sertifikat-klien"
      ? {
          client: "client_id",
          am: "account_manager_id",
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
  pageSize = 20,
) {
  const db = await masterClient();
  const page = Math.max(
    1,
    Math.min(100000, Math.floor(Number(params.page) || 1)),
  );
  const size = Math.max(1, Math.min(1000, pageSize));
  const sort = [...entity.columns, entity.idKey].includes(params.sort || "")
    ? params.sort!
    : entity.columns[0];
  let query = db
    .from(entity.readTable || entity.table)
    .select("*", { count: "exact" });
  if (entity.key !== "roles")
    query = query.eq(entity.key === "cabang" ? "code" : "branch_code", branch);
  const search = safeSearch(params.q || "");
  for (const term of search.split(/\s+/).filter(Boolean).slice(0, 8))
    query = query.or(
      entity.search.map((field) => `${field}.ilike.%${term}%`).join(","),
    );
  if (params.active === "true" || params.active === "false")
    query = query.eq("is_active", params.active === "true");
  const field = entity.fields.find(
    (field) => field.key === params.filter && field.kind === "select",
  );
  if (field && field.options?.some((option) => option.value === params.value))
    query = query.eq(field.key, params.value!);
  if (parent) query = query.eq(parent.field, parent.id);
  for (const [column, value] of operationalFilterPairs(entity.key, params))
    query = query.eq(column, value);
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
  query = query.order(sort, {
    ascending: params.dir !== "desc",
    nullsFirst: false,
  });
  if (sort !== entity.idKey)
    query = query.order(entity.idKey, { ascending: true });
  const { data, count, error } = await query.range(
    (page - 1) * size,
    page * size - 1,
  );
  if (error)
    throw new Error(
      "Data belum dapat dimuat. Silakan coba kembali atau hubungi administrator.",
    );
  const rows = (data ?? []) as DataRow[];
  for (const row of rows)
    if (typeof row.previous_order_value_text === "string")
      row.previous_order_value = row.previous_order_value_text;
  const labels: Record<string, Record<string, string>> = {};
  await Promise.all(
    entity.fields
      .filter((field) => field.kind === "lookup")
      .map(async (field) => {
        const target = getEntity(field.lookup!);
        const ids = [
          ...new Set(
            rows
              .map((row) => row[field.key])
              .filter((value): value is string => typeof value === "string"),
          ),
        ];
        if (!target || !ids.length) return;
        const { data } = await db
          .from(target.table)
          .select(`${target.idKey},${target.labelKey}`)
          .in(target.idKey, ids)
          .limit(20);
        const visible = (data || []) as unknown as DataRow[];
        labels[field.key] = Object.fromEntries(
          visible.map((row) => [
            String(row[target.idKey]),
            String(row[target.labelKey] || row[target.idKey]),
          ]),
        );
      }),
  );
  return {
    rows,
    labels,
    total: count ?? 0,
    page,
    size,
    sort,
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
  if (data && typeof data.previous_order_value_text === "string")
    data.previous_order_value = data.previous_order_value_text;
  return data as DataRow | null;
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
