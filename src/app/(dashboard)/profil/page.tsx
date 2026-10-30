import { requireActiveUser } from "@/lib/auth/guards";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/shared/change-password-form";
export default async function ProfilePage() {
  const { user, profile, scopes } = await requireActiveUser();
  return (
    <>
      <PageHeader
        title="Profil Saya"
        description="Identitas akun dan penugasan yang diverifikasi dari database. Perubahan kewenangan hanya dilakukan administrator."
      />
      <Card className="max-w-3xl space-y-5 p-5">
        <dl className="grid gap-5 text-sm sm:grid-cols-2">
          {[
            ["Nama tampilan", profile.full_name || "—"],
            ["Email login", user.email || "—"],
            ["Cabang identitas", profile.branch_code],
            ["WhatsApp", profile.whatsapp || "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-border pt-5">
          <h2 className="text-sm font-bold">Penugasan aktif</h2>
          <ul className="mt-3 space-y-2 text-xs">
            {scopes.map((scope) => (
              <li key={scope.branch_code + scope.role_code}>
                {ROLE_LABELS[scope.role_code]} · {scope.branch_code}
              </li>
            ))}
          </ul>
        </div>
      </Card>
      <Card className="mt-5 max-w-3xl p-5">
        <h2 className="text-base font-bold text-brand-navy">Ganti password</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ubah password akun Anda sendiri. Setelah berhasil, Anda akan kembali
          ke halaman login untuk masuk menggunakan password baru.
        </p>
        <ChangePasswordForm />
      </Card>
    </>
  );
}
