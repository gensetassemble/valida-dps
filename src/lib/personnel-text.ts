// Presentation normalization only; source identity and NPP remain unchanged.
export function personnelText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("id")
    .replace(/\p{L}[\p{L}\p{M}]*/gu, word => word[0].toLocaleUpperCase("id") + word.slice(1));
}
export function positionText(value: unknown) {
  return personnelText(value).replace(/\b(?:And|Or|Of|The|For|With|In|On|At|Dan|Atau|Di|Ke|Dari|Untuk|Dengan)\b/g, word=>word.toLowerCase());
}
export function personnelRow<T extends Record<string, unknown>>(row: T): T {
  const result = { ...row };
  for (const key of ["full_name", "employee_name", "position", "job_title"])
    if (typeof result[key] === "string") (result as Record<string, unknown>)[key] = ["position","job_title"].includes(key) ? positionText(result[key]) : personnelText(result[key]);
  if(typeof result.verification_note === "string") (result as Record<string,unknown>).verification_note=verificationNotes(result.verification_note);
  return result;
}
export function processNotes(value: unknown) {
  const clean=String(value ?? "").replace(/\s*Sumber SHA-?256\s*[:：]?\s*[a-f0-9]{64}\.?/gi, "").trim();
  return /^Konfirmasi Aktif dan Terverifikasi sesuai Demografi Pegawai\.xlsx[;\s]/i.test(clean) ? "Diverifikasi oleh Super Admin berdasarkan master pegawai." : clean;
}
export function verificationNotes(value: unknown) {
  const clean=processNotes(value);
  return /^Konfirmasi Aktif dan Terverifikasi sesuai Demografi Pegawai\.xlsx[;\s]/i.test(clean)
    ? "Diverifikasi oleh Super Admin berdasarkan master pegawai."
    : clean;
}
