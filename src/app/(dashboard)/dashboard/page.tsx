import { requireActiveUser } from "@/lib/auth/guards";
import { getConnectionStatus } from "@/lib/microsoft/mail-service";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
export default async function DashboardPage() {
  const { profile } = await requireActiveUser();
  const outlook = getConnectionStatus();
  return <main className="mx-auto max-w-4xl px-6 py-16"><div className="flex items-center justify-between"><h1 className="text-3xl font-bold">Ruang kerja VALIDA</h1><form action={logout}><Button variant="outline">Keluar</Button></form></div><p className="mt-4">Cabang {profile.branch_code} · Fondasi infrastruktur</p><section className="mt-8 rounded-xl border border-border bg-white p-6"><h2 className="text-lg font-bold">Integrasi Outlook: {outlook.state}</h2><p className="mt-2 text-sm text-muted-foreground">{outlook.message}</p></section><p className="mt-8 text-sm text-muted-foreground">Modul operasional belum diimplementasikan pada tahap ini.</p></main>;
}
