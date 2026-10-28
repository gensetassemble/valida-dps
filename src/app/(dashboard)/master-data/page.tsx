import Link from "next/link";
import { ArrowUpRight, Database } from "lucide-react";
import { requireActiveUser } from "@/lib/auth/guards";
import { hasPermission, activeBranch } from "@/lib/auth/permissions";
import { MASTER_KEYS, ENTITIES } from "@/features/master-data/registry";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
export default async function MasterOverview({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const context = await requireActiveUser();
  const params = await searchParams;
  const branch = activeBranch(
    context.scopes,
    context.profile.branch_code,
    params.branch,
  );
  return (
    <>
      <PageHeader
        title="Master Data"
        description="Katalog, identitas organisasi, dan referensi yang menjadi dasar pengelolaan sertifikasi."
        eyebrow={`Data cabang ${branch}`}
      />
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs leading-6 text-emerald-900">
        <Database size={20} className="mt-1 shrink-0" />
        <p>
          Data ditampilkan sesuai penugasan cabang, peran, dan portofolio.
          Direktori pegawai tidak otomatis membuat akun login. Data contoh
          katalog tidak menjadi bukti persyaratan atau regulasi resmi.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MASTER_KEYS.map((key) => ENTITIES[key])
          .filter((entity) =>
            hasPermission(context.scopes, branch, entity.readRoles),
          )
          .map((entity) => (
            <Link
              key={entity.key}
              href={`${entity.path}?branch=${branch}`}
              className="rounded-lg focus-visible:outline-primary-hover"
            >
              <Card className="flex h-full flex-col p-5 transition-colors hover:border-emerald-300">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-brand-navy">
                    {entity.title}
                  </h2>
                  <ArrowUpRight size={16} className="text-primary-hover" />
                </div>
                <p className="my-3 flex-1 text-xs leading-6 text-muted-foreground">
                  {entity.description}
                </p>
                <p className="border-t border-border pt-3 text-[11px] font-semibold text-primary-hover">
                  {hasPermission(context.scopes, branch, entity.writeRoles)
                    ? "Kelola data"
                    : "Lihat data sesuai akses"}
                </p>
              </Card>
            </Link>
          ))}
      </div>
    </>
  );
}
