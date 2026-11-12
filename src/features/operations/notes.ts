// Import diagnostics remain in database/source provenance, not in business UI.
const generatedImportStatements = new Set([
  "tanpa nomor urut sumber",
  "tag dan sertifikat berulang",
  "cek apakah detail pengukuran atau kalibrasi berbeda",
  "tanggal berakhir belum tersedia",
  "tanggal akhir berbeda dari interval tercatat",
]);

function generatedImportNote(value: string) {
  const clauses = value.split(/\s*;\s*/).filter(Boolean);
  return clauses.length > 0 && clauses.every((clause) =>
    generatedImportStatements.has(clause.trim().replace(/\.$/, "").toLocaleLowerCase("id")),
  );
}

export function businessNotes(value: unknown) {
  return String(value ?? "")
    .split(/\s*\|\s*/)
    .filter(
      (part) =>
        part.trim() &&
        !generatedImportNote(part.trim()) && ![
          /^Observasi sumber identik ditautkan ke satu peristiwa\.?$/i,
          /^Kandidat (?:aset|alat|pegawai)\s*:/i,
          /^(?:Kondisi|Status) sumber\s*:/i,
          /\b(?:xlsx?|csv)\b.*\bbaris\s*\d+/i,
          /^(?:BTB|MIN|BBR|PIK|LAB|HMPM|KSP|LSI|SERCO|IND|AEBT)\b.*\bbaris\s*\d+/i,
          /^Tag berulang[;,]/i,
          /identitas kandidat perlu ditinjau/i,
          /\b(?:Raw CSV|staging|provenance|source_import_row_id)\b/i,
        ].some((pattern) => pattern.test(part.trim())),
    )
    .map((part) => part.trim())
    .join(" | ");
}
export function preserveImportNotes(original: unknown, edited: unknown) {
  const diagnostics = String(original ?? "")
    .split(/\s*\|\s*/)
    .filter((part) => part.trim() && !businessNotes(part));
  return (
    [businessNotes(edited), ...diagnostics].filter(Boolean).join(" | ") || null
  );
}
