"use server";
// Keep old action URLs harmless for clients opened before password-only sign-in.
export async function startMfaEnrollment(): Promise<{ error?: string; id?: string; qr?: string }> {
  return { error: "Authenticator tidak digunakan. Masuk dengan email dan password." };
}
export async function verifyMfaCode(input: unknown): Promise<{ error?: string; ok?: boolean }> {
  void input;
  return { error: "Authenticator tidak digunakan. Masuk dengan email dan password." };
}
