export const calibrationMarkPairs = [
  ["calibration_internal", "calibration_external"],
  ["significant_yes", "significant_no"],
] as const;
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
