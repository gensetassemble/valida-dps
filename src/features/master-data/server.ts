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
export async function listRecords(
  entity: EntityConfig,
  branch: string,
  params: QueryParams = {},
  parent?: { field: string; id: string },
) {
  const db = await masterClient();
  const page = Math.max(
    1,
    Math.min(100000, Math.floor(Number(params.page) || 1)),
  );
  const size = 20;
  const sort = [...entity.columns, entity.idKey].includes(params.sort || "")
    ? params.sort!
    : entity.columns[0];
  let query = db.from(entity.table).select("*", { count: "exact" });
  if (entity.key !== "roles")
    query = query.eq(entity.key === "cabang" ? "code" : "branch_code", branch);
  const search = safeSearch(params.q || "");
  if (search)
    query = query.or(
      entity.search.map((field) => `${field}.ilike.%${search}%`).join(","),
    );
  if (params.active === "true" || params.active === "false")
    query = query.eq("is_active", params.active === "true");
  const field = entity.fields.find(
    (field) => field.key === params.filter && field.kind === "select",
  );
  if (field && field.options?.some((option) => option.value === params.value))
    query = query.eq(field.key, params.value!);
  if (parent) query = query.eq(parent.field, parent.id);
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
  let query = db.from(entity.table).select("*").eq(entity.idKey, id);
  if (entity.key !== "roles")
    query = query.eq(entity.key === "cabang" ? "code" : "branch_code", branch);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("Detail data belum dapat dimuat.");
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
