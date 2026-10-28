import Link from "next/link";
import { Database, Users, ShieldCheck, Mail, ArrowRight } from "lucide-react";
import { requireActiveUser } from "@/lib/auth/guards";
import { getConnectionStatus } from "@/lib/microsoft/mail-service";
import { hasPermission, ROLE_LABELS } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const { user, profile, scopes } = await requireActiveUser();
  const branch = (await searchParams).branch || profile.branch_code;
  const mail = getConnectionStatus();
  return (
    <>
      <PageHeader
        title="Dashboard"
        eyebrow={"Ruang kerja cabang " + branch}
        description="Kelola referensi yang tepercaya sebelum pencatatan sertifikat dan kalibrasi dimulai."
      />
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h2 className="text-lg font-bold text-brand-navy">
              Selamat datang, {profile.full_name || user.email}
            </h2>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-muted-foreground">
              Fondasi database, otorisasi, dan master data tersedia. Ringkasan
              sertifikat, peluang perpanjangan, serta laporan operasional akan
              tersedia setelah modul terkait dikembangkan.
            </p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-900">
            Tahap 02 · Master Data
          </span>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <Database className="mb-4 text-primary-hover" size={22} />
          <h2 className="text-sm font-bold">Referensi &amp; master data</h2>
          <p className="my-3 text-xs leading-6 text-muted-foreground">
            Cabang, wilayah, portofolio, identitas pegawai, dan jenis sertifikat
            dalam cakupan Anda.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href={"/master-data?branch=" + branch}>
              Buka master data
              <ArrowRight />
            </Link>
          </Button>
        </Card>
        {hasPermission(scopes, branch, [
          "admin",
          "account_manager",
          "qshe",
          "branch_head",
        ]) && (
          <Card className="p-5">
            <Users className="mb-4 text-primary-hover" size={22} />
            <h2 className="text-sm font-bold">Pelanggan &amp; kontak</h2>
            <p className="my-3 text-xs leading-6 text-muted-foreground">
              Pelihara identitas pelanggan dan kontak yang menjadi tanggung
              jawab Anda.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={"/pelanggan?branch=" + branch}>
                Buka pelanggan
                <ArrowRight />
              </Link>
            </Button>
          </Card>
        )}
        <Card className="p-5">
          <ShieldCheck className="mb-4 text-primary-hover" size={22} />
          <h2 className="text-sm font-bold">Akses Anda</h2>
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            {scopes
              .filter((scope) => scope.branch_code === branch)
              .map((scope) => (
                <li key={scope.role_code}>{ROLE_LABELS[scope.role_code]}</li>
              ))}
          </ul>
          <Link
            className="mt-4 inline-block text-xs font-semibold text-primary-hover hover:underline"
            href="/profil"
          >
            Lihat profil dan penugasan
          </Link>
        </Card>
      </div>
      <section className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-white p-4">
        <Mail size={19} className="mt-0.5 shrink-0 text-muted-foreground" />
        <div>
          <h2 className="text-xs font-bold">Microsoft 365 · {mail.state}</h2>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            {mail.message} Belum ada pengiriman email atau jadwal pengingat
            aktif.
          </p>
        </div>
      </section>
    </>
  );
}
