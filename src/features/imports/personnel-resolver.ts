import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { personnelRenewalIntent, validateNormalized } from "./normalize";

type ImportRow = {
  normalized: Record<string, string>;
  issues: string[];
  status: string;
};

const identity = (value: unknown) =>
  String(value || "")
    .toLocaleLowerCase("id")
    .replace(/[^a-z0-9]/g, "");

export async function resolvePersonnelImportRows<T extends ImportRow>(
  db: SupabaseClient<Database>,
  branch: string,
  rows: T[],
) {
  const [{ data: employees, error: employeeError }, { data: types, error: typeError }] =
    await Promise.all([
      db
        .from("employee_directory")
        .select("id,npp,full_name")
        .eq("branch_code", branch)
        .limit(5000),
      db
        .from("certificate_types")
        .select("id,name")
        .eq("branch_code", branch)
        .eq("category", "personnel")
        .eq("is_active", true)
        .limit(1000),
    ]);
  if (employeeError || typeError)
    throw Error("Daftar pegawai atau jenis kompetensi belum dapat dicocokkan.");

  const byNpp = new Map<string, (typeof employees)[number][]>();
  const byName = new Map<string, (typeof employees)[number][]>();
  for (const employee of employees || []) {
    if (employee.npp) {
      const list = byNpp.get(employee.npp) || [];
      list.push(employee);
      byNpp.set(employee.npp, list);
    }
    const key = identity(employee.full_name);
    const list = byName.get(key) || [];
    list.push(employee);
    byName.set(key, list);
  }
  const typeByName = new Map<string, (typeof types)[number][]>();
  for (const type of types || []) {
    const key = identity(type.name);
    const list = typeByName.get(key) || [];
    list.push(type);
    typeByName.set(key, list);
  }

  const employeeIds = new Set<string>();
  const prepared = rows.map((row) => {
    const normalized = { ...row.normalized };
    const matches = normalized.employee_id
      ? (employees || []).filter((employee) => employee.id === normalized.employee_id)
      : normalized.npp
        ? byNpp.get(normalized.npp) || []
        : byName.get(identity(normalized.employee_name)) || [];
    const resolutionIssues: string[] = [];
    if (matches.length === 1) normalized.employee_id = matches[0].id;
    else if (matches.length > 1)
      resolutionIssues.push("Pegawai pada file cocok dengan lebih dari satu data. Pilih pegawai yang benar.");
    if (normalized.employee_id) employeeIds.add(normalized.employee_id);
    return { row, normalized, resolutionIssues };
  });

  const { data: certificates, error: certificateError } = employeeIds.size
    ? await db
        .from("personnel_certificates")
        .select(
          "id,employee_id,certificate_type_id,certificate_number,original_title,issue_date,expiry_date,validity_kind",
        )
        .eq("branch_code", branch)
        .in("employee_id", [...employeeIds])
        .eq("is_active", true)
        .limit(5000)
    : { data: [], error: null };
  if (certificateError)
    throw Error("Sertifikat yang sudah ada belum dapat dicocokkan.");

  return prepared.map(({ row, normalized, resolutionIssues }) => {
    const candidates = (certificates || []).filter(
      (certificate) => certificate.employee_id === normalized.employee_id,
    );
    const oldNumber = normalized.existing_certificate_number || normalized.certificate_number;
    let targets = oldNumber
      ? candidates.filter(
          (certificate) => identity(certificate.certificate_number) === identity(oldNumber),
        )
      : [];
    if (!targets.length && normalized.original_title) {
      const byTitle = candidates.filter(
        (certificate) => identity(certificate.original_title) === identity(normalized.original_title),
      );
      if (byTitle.length === 1) targets = byTitle;
    }
    if (targets.length === 1) {
      const target = targets[0];
      normalized.target_certificate_id = target.id;
      normalized.certificate_type_id ||= target.certificate_type_id;
      normalized.existing_certificate_number ||= target.certificate_number || "";
      normalized.change_reason ||= "data_correction";
    } else if (targets.length > 1) {
      resolutionIssues.push(
        "Sertifikat pada file cocok dengan lebih dari satu rekaman. Isi nomor sertifikat lama atau periksa datanya.",
      );
    }
    if (!normalized.certificate_type_id) {
      const matches = typeByName.get(identity(normalized.original_title)) || [];
      if (matches.length === 1) normalized.certificate_type_id = matches[0].id;
      else if (matches.length > 1)
        resolutionIssues.push("Judul lisensi cocok dengan lebih dari satu jenis kompetensi.");
    }
    normalized.renewal_intent = personnelRenewalIntent(normalized);
    const validation = validateNormalized("personnel", normalized);
    const issues = [...new Set([...resolutionIssues, ...validation])];
    return {
      ...row,
      normalized,
      issues,
      status: row.status === "duplicate" ? "duplicate" : issues.length ? "needs_review" : "ready",
    };
  });
}
