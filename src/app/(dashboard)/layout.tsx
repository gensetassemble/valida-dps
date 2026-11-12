import { AppShell } from "@/components/app-shell/app-shell";
import { requireActiveUser } from "@/lib/auth/guards";
import { masterClient } from "@/features/master-data/server";
import { SimulationControls } from "@/components/shared/simulation-controls";
export default async function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const { user, profile, scopes, branches, isSimulation,canSimulate } = await requireActiveUser();
  const { count, error } = await (
    await masterClient()
  )
    .from("notification_user_feed")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("branch_code",profile.branch_code)
    .is("user_archived_at", null)
    .is("read_at", null);
  if (error) throw Error("Jumlah notifikasi belum dapat dimuat.");
  return (
    <AppShell
      user={{
        name: profile.full_name || user.email || "Pengguna",
        email: user.email || "",
        branch: profile.branch_code,
        scopes,
        branches,
        unreadCount: count || 0,
      }}
    >
      {children}
      {modal}
      {canSimulate && <SimulationControls active={isSimulation}/>}
    </AppShell>
  );
}
