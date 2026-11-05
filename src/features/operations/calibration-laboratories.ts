export const calibrationLaboratories = [
  "PT SUCOFINDO Laboratorium Cibitung",
  "Laboratorium SNSU-BSN", "BRIN", "BSPJI", "PUSARPEDAL", "PSIKLH",
  "PT Kaliman", "PT AUS NDT", "PT Caltesys Indonesia",
  "PT Caltesys Indonesia (SBY)", "PT Delta Instrumen",
  "PT Enseval Medika Prima", "PT Trusur Unggul Teknusa",
] as const;

export const calibrationLaboratoryAliases: Record<string, string> = {
  "lab cibitung": "PT SUCOFINDO Laboratorium Cibitung",
  "lab. cibitung": "PT SUCOFINDO Laboratorium Cibitung",
  "lab.cibitung": "PT SUCOFINDO Laboratorium Cibitung",
  "laboratorium cibitung": "PT SUCOFINDO Laboratorium Cibitung",
  "pt. sucofindo lab cibitung": "PT SUCOFINDO Laboratorium Cibitung",
  "pt. sucofindo laboratorium cibitung": "PT SUCOFINDO Laboratorium Cibitung",
  "pt.sucofindo lab. cibitung": "PT SUCOFINDO Laboratorium Cibitung",
  "pt kaliman": "PT Kaliman",
  "pt. kaliman": "PT Kaliman",
  "pt. aus ndt": "PT AUS NDT",
  "pt. caltesys indonesia": "PT Caltesys Indonesia",
  "pt. caltesys indonesia - sby": "PT Caltesys Indonesia (SBY)",
  "pt. delta instrumen": "PT Delta Instrumen",
  "pt. enseval medika prima": "PT Enseval Medika Prima",
  "pt. trusur unggul teknusa": "PT Trusur Unggul Teknusa",
  "'pusarpedal": "PUSARPEDAL",
};

export function normalizeCalibrationLaboratory(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  const key = clean.toLocaleLowerCase("id");
  return calibrationLaboratoryAliases[key] ||
    calibrationLaboratories.find((name) => name.toLocaleLowerCase("id") === key) || clean;
}
