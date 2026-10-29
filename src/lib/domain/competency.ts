import { validity, todayWita } from "./validity";
export type Requirement = {
  certificate_type_id: string;
  verification_status: string;
};
export type CompetencyEvidence = Requirement & {
  expiry_date: string | null;
  validity_kind: string;
};
export function evaluateRequirements(
  requirements: Requirement[],
  certificates: CompetencyEvidence[],
  today = todayWita(),
) {
  if (
    !requirements.length ||
    requirements.some((r) => r.verification_status !== "verified")
  )
    return {
      allowed: false,
      status: "Persyaratan Belum Diverifikasi",
      checks: [],
    };
  const checks = [
    ...new Set(requirements.map((r) => r.certificate_type_id)),
  ].map((type) => {
    const matching = certificates.filter((c) => c.certificate_type_id === type);
    const allowed = matching.some(
      (c) =>
        !["Expired", "Perlu Verifikasi"].includes(
          validity(
            c.expiry_date,
            c.verification_status === "verified",
            c.validity_kind === "lifetime",
            today,
          ),
        ),
    );
    return {
      type,
      allowed,
      status: allowed
        ? "Memenuhi bukti terverifikasi"
        : matching.some(
              (c) =>
                c.verification_status === "verified" &&
                validity(
                  c.expiry_date,
                  true,
                  c.validity_kind === "lifetime",
                  today,
                ) === "Expired",
            )
          ? "Kompetensi wajib terverifikasi expired"
          : "Belum ada bukti terverifikasi",
    };
  });
  return {
    allowed: checks.every((c) => c.allowed),
    status: checks.every((c) => c.allowed)
      ? "Memenuhi bukti persyaratan"
      : "Pemilihan diblokir untuk ditinjau",
    checks,
  };
}
