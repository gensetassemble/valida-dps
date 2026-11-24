import { AccessDenied } from "@/components/ui/access-denied";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { importPageContext } from "@/features/imports/server";
import { ImportUpload } from "@/features/imports/forms";
import { DOMAIN_LABELS, type ImportDomain } from "@/features/imports/normalize";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const c = await importPageContext((await searchParams).branch);
  if (!c) return <AccessDenied />;
  const { data, error } = await c.db
    .from("import_batches")
    .select("id,filename,domain,source_count,created_at")
    .eq("branch_code", c.branch)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw Error("Riwayat impor belum dapat dimuat.");
  return (
    <>
      <PageHeader
        title="Impor Data"
        description="Unggah file, periksa perubahan, lalu terapkan pembaruan setelah datanya sesuai."
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-bold">
            Unggah file untuk diperiksa
          </h2>
          <ImportUpload
            branch={c.branch}
            initialDomain={c.allowedDomains[0]!}
            domains={c.allowedDomains}
          />
          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            Data website tidak langsung berubah. Anda akan melihat hasil
            pemeriksaan terlebih dahulu sebelum pembaruan diterapkan.
          </p>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-bold">
            Riwayat impor terbaru · cabang {c.branch}
          </h2>
          {data?.length ? (
            data.map((b) => (
              <Link
                key={String(b.id)}
                className="mb-3 block rounded-lg border border-border p-3 hover:bg-slate-50"
                href={"/impor-data/" + b.id + "?branch=" + c.branch}
              >
                <strong className="text-xs">{String(b.filename)}</strong>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {DOMAIN_LABELS[b.domain as ImportDomain]} ·{" "}
                  {String(b.source_count)} baris dari file
                </p>
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Belum ada riwayat impor.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
