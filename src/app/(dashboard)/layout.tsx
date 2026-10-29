import { AppShell } from "@/components/app-shell/app-shell";
import { requireActiveUser } from "@/lib/auth/guards";
export default async function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const { user, profile, scopes, branches } = await requireActiveUser();
  return (
    <AppShell
      user={{
        name: profile.full_name || user.email || "Pengguna",
        email: user.email || "",
        branch: profile.branch_code,
        scopes,
        branches,
      }}
    >
      {children}
      {modal}
    </AppShell>
  );
}
