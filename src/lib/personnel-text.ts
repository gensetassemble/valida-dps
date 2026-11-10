// Presentation normalization only; source identity and NPP remain unchanged.
export function personnelText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("id")
    .replace(/\p{L}[\p{L}\p{M}]*/gu, word => word[0].toLocaleUpperCase("id") + word.slice(1));
}
export function personnelRow<T extends Record<string, unknown>>(row: T): T {
  const result = { ...row };
  for (const key of ["full_name", "employee_name", "position", "job_title"])
    if (typeof result[key] === "string") (result as Record<string, unknown>)[key] = personnelText(result[key]);
  return result;
}
export function processNotes(value: unknown) {
  return String(value ?? "").replace(/\s*Sumber SHA-?256\s*[:：]?\s*[a-f0-9]{64}\.?/gi, "").trim();
}
