import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const context = await requireActiveUser();
  const branch = (await searchParams).branch || context.profile.branch_code;
  redirect(
    hasPermission(context.scopes, branch, ["admin"])
      ? `/pengaturan/pengguna?branch=${branch}`
      : "/profil",
  );
}
