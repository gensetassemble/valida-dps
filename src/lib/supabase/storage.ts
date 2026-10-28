import "server-only";
export const CERTIFICATE_BUCKET = "certificate-documents";
export const CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;
export const SIGNED_URL_TTL_SECONDS = 60;
export function validateCertificate(file: { name: string; type: string; size: number }, header: Uint8Array) {
  if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf" || new TextDecoder().decode(header.slice(0, 5)) !== "%PDF-") throw new Error("Dokumen harus berupa PDF yang valid.");
  if (file.size <= 0 || file.size > CERTIFICATE_MAX_BYTES) throw new Error("Ukuran dokumen harus 1 byte sampai 10 MiB.");
}
// No privileged client or bypass exists. Future record-level authorization must precede enabling these operations.
export async function uploadCertificate(): Promise<never> { throw new Error("Unggah dinonaktifkan sampai kebijakan akses per sertifikat tersedia."); }
export async function getCertificateSignedUrl(): Promise<never> { throw new Error("Pratinjau dan unduh dinonaktifkan sampai kebijakan akses per sertifikat tersedia."); }
