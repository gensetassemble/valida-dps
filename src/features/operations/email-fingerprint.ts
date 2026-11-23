export async function emailFingerprint(value: { certificate: string; branch: string; recipient: string; subject: string; body: string; mode: string }) {
  const bytes = new TextEncoder().encode(JSON.stringify([value.certificate,value.branch,value.recipient.toLowerCase(),value.subject,value.body,value.mode]));
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), v => v.toString(16).padStart(2,"0")).join("");
}
