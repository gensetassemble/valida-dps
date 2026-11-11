export const calibrationMarkPairs = [
  ["calibration_internal", "calibration_external"],
  ["significant_yes", "significant_no"],
] as const;
export const internalCalibrationLaboratory = "PT SUCOFINDO Laboratorium Cibitung";

export function laboratoryForCalibrationChoice(mark: string, current: unknown) {
  if (calibrationMark(mark) === "√") return internalCalibrationLaboratory;
  return String(current ?? "") === internalCalibrationLaboratory ? "" : String(current ?? "");
}
export function calibrationMark(value: unknown): string {
  const text = String(value ?? "")
    .trim()
    .replace(/^'/, "");
  if (["√", "✓", "✔"].includes(text)) return "√";
  return text;
}
export function pairedCalibrationField(key: string) {
  const prefix = key.startsWith("initial_") ? "initial_" : "";
  const field = key.slice(prefix.length);
  const pair = calibrationMarkPairs.find((p) => p.some((k) => k === field));
  return pair ? prefix + pair.find((k) => k !== field)! : null;
}
export function oppositeCalibrationMark(value: string) {
  return calibrationMark(value) === "√" ? "-" : "√";
}

// A single user choice still fills both columns of the monitoring report.
export function calibrationChoice(key: string) {
  const field = key.replace(/^initial_/, "");
  if (field === "calibration_internal")
    return {
      label: "Jenis kalibrasi",
      options: [
        { value: "√", label: "Internal" },
        { value: "-", label: "Eksternal" },
      ],
    };
  if (field === "significant_yes")
    return {
      label: "Signifikan",
      options: [
        { value: "√", label: "Ya" },
        { value: "-", label: "Tidak" },
      ],
    };
  return null;
}

export function calibrationChoiceValue(primary: unknown, secondary: unknown) {
  const value = calibrationMark(primary);
  // Do not silently pick a side when historical marks conflict or are incomplete.
  return ["√", "-"].includes(value) &&
    calibrationMark(secondary) === oppositeCalibrationMark(value)
    ? value
    : "";
}

export function calibrationChoiceLabel(key: string, row: Record<string, unknown>) {
  const choice = calibrationChoice(key);
  const pair = pairedCalibrationField(key);
  if (!choice || !pair) return "—";
  const selected = calibrationChoiceValue(row[key], row[pair]);
  return choice.options.find((option) => option.value === selected)?.label ||
    (calibrationMark(row[key]) || calibrationMark(row[pair]) ? "Periksa pilihan" : "Belum diisi");
}
