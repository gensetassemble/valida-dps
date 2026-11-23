export const MANAGED_PASSWORD_MESSAGE =
  "Password akun demo dikelola oleh IT Officer dan tidak dapat diubah dari VALIDA.";

const MANAGED_PASSWORD_EMAILS = new Set(["tester@tester.com"]);

export function isPasswordManagedAccount(email: string | null | undefined) {
  return Boolean(
    email && MANAGED_PASSWORD_EMAILS.has(email.trim().toLowerCase()),
  );
}
