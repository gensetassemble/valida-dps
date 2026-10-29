import "server-only";
import { entityContext, masterClient } from "@/features/master-data/server";
import { evaluateRequirements } from "@/lib/domain/competency";
export async function checkCompetency(
  employee: string,
  service: string,
  branch: string,
) {
  const c = await entityContext("kompetensi-personil", branch);
  const db = await masterClient();
  const e = await db
    .from("employee_directory")
    .select("id,is_active,employment_status,verification_status")
    .eq("id", employee)
    .eq("branch_code", c.branch)
    .maybeSingle();
  if (!e.data) throw Error("Pegawai tidak dapat diakses.");
  if (
    !e.data.is_active ||
    e.data.employment_status !== "active" ||
    e.data.verification_status !== "verified"
  )
    return {
      allowed: false,
      status: "Identitas Pegawai Belum Diverifikasi atau Tidak Aktif",
      checks: [],
    };
  const { data: activeService } = await db
    .from("service_types")
    .select("id")
    .eq("id", service)
    .eq("branch_code", c.branch)
    .eq("is_active", true)
    .maybeSingle();
  if (!activeService)
    return {
      allowed: false,
      status: "Persyaratan Belum Diverifikasi",
      checks: [],
    };
  const { data: requirements, error } = await db
    .from("service_competency_requirements")
    .select("certificate_type_id,verification_status")
    .eq("service_type_id", service)
    .eq("branch_code", c.branch)
    .eq("is_active", true);
  if (error) throw Error("Persyaratan belum dapat dimuat.");
  if (
    !requirements?.length ||
    requirements.some((r) => r.verification_status !== "verified")
  )
    return {
      allowed: false,
      status: "Persyaratan Belum Diverifikasi",
      checks: [],
    };
  const types = requirements.map((r) => String(r.certificate_type_id));
  const { data: certs } = await db
    .from("personnel_certificates")
    .select("certificate_type_id,verification_status,expiry_date,validity_kind")
    .eq("employee_id", employee)
    .eq("is_active", true)
    .in("certificate_type_id", types)
    .limit(501);
  if (!certs || certs.length > 500)
    return {
      allowed: false,
      status: "Bukti kompetensi perlu ditinjau",
      checks: [],
    };
  return evaluateRequirements(requirements, certs);
}
