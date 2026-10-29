import "server-only";
export const CERTIFICATE_BUCKET = "certificate-documents";
export const CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;
export const SIGNED_URL_TTL_SECONDS = 60;
export function validateCertificate(
  file: { name: string; type: string; size: number },
  header: Uint8Array,
) {
  if (
    !file.name.toLowerCase().endsWith(".pdf") ||
    file.type !== "application/pdf" ||
    new TextDecoder().decode(header.slice(0, 5)) !== "%PDF-"
  )
    throw new Error("Dokumen harus berupa PDF yang valid.");
  if (file.size <= 0 || file.size > CERTIFICATE_MAX_BYTES)
    throw new Error("Ukuran dokumen harus 1 byte sampai 10 MiB.");
}
// Unscoped legacy operations stay closed. Operational routes authorize a real parent and use its session-bound client.
export async function uploadCertificate(): Promise<never> {
  throw new Error(
    "Operasi dokumen tanpa identitas rekaman bisnis tidak diizinkan.",
  );
}
export async function getCertificateSignedUrl(): Promise<never> {
  throw new Error(
    "Akses dokumen tanpa identitas rekaman bisnis tidak diizinkan.",
  );
}
