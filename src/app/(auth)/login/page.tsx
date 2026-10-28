import { AuthForm } from "@/components/shared/auth-form";
import { getSupabaseConfig } from "@/lib/env/public";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const notices: Record<string, string> = {
    inactive: "Akun belum diaktifkan. Hubungi administrator cabang.",
    "callback-error": "Tautan pemulihan tidak valid atau telah kedaluwarsa.",
    "password-updated": "Kata sandi telah diperbarui. Silakan masuk kembali.",
  };
  return (
    <>
      <h1 className="text-2xl font-bold">Masuk ke VALIDA</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Gunakan akun yang telah disediakan dan diaktifkan administrator.
      </p>
      {status && notices[status] && (
        <p role="status" className="mt-4 rounded-lg bg-muted p-3 text-sm">
          {notices[status]}
        </p>
      )}
      <AuthForm mode="login" configured={!!getSupabaseConfig()} />
    </>
  );
}
