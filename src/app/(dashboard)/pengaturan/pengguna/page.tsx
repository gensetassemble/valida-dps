import Link from "next/link";
import { requireActiveUser } from "@/lib/auth/guards";
import { activeBranch, hasPermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { MasterPage } from "@/features/master-data/pages";
import type { QueryParams } from "@/features/master-data/server";
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const context = await requireActiveUser();
  params.branch = activeBranch(
    context.scopes,
    context.profile.branch_code,
    params.branch,
  );
  if (!hasPermission(context.scopes, params.branch, ["admin"]))
    return (
      <PageHeader
        title="Akses ditolak"
        description="Pengaturan pengguna hanya tersedia bagi administrator pada cabang yang ditugaskan."
      />
    );
  return (
    <>
      <div className="mb-5 flex gap-5 text-xs font-semibold">
        <Link
          href={`/pengaturan/pengguna?branch=${params.branch || "DPS"}`}
          className="text-primary-hover underline underline-offset-8"
        >
          Pengguna
        </Link>
        <Link href={`/pengaturan/roles?branch=${params.branch || "DPS"}`}>
          Peran &amp; penugasan
        </Link>
      </div>
      <MasterPage entity="pengguna" params={params} />
    </>
  );
}
