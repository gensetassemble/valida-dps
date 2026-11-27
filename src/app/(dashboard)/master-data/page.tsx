import Link from "next/link";
import { ArrowUpRight, Building2, MapPin, Briefcase, Users, Gauge, Contact, UserRound, Network, BadgeCheck, Layers } from "lucide-react";
import { requireActiveUser } from "@/lib/auth/guards";
import { hasPermission, activeBranch } from "@/lib/auth/permissions";
import { MASTER_KEYS, ENTITIES } from "@/features/master-data/registry";
import { PageHeader } from "@/components/ui/page-header";
import { DirectoryAccessMatrix } from "@/features/master-data/access-matrix";

const groups = [
  { title: "Organisasi & pegawai", items: [
    { key: "cabang", icon: Building2, description: "Identitas dan informasi cabang." },
    { key: "wilayah", icon: MapPin, description: "Daftar wilayah kerja cabang." },
    { key: "portofolio", icon: Briefcase, description: "Bidang layanan dan portofolio." },
    { key: "pegawai", icon: Users, description: "Identitas dan status pegawai." },
  ] },
  { title: "Penanggung jawab", items: [
    { key: "am-marketing", icon: Contact, description: "Kontak AM dan Marketing." },
    { key: "koordinator-operasional", icon: UserRound, description: "Kontak koordinator operasional." },
    { key: "penetapan-koordinator", icon: Network, description: "Penugasan koordinator per portofolio." },
  ] },
  { title: "Sertifikat & peralatan", items: [
    { key: "kalibrasi-alat", icon: Gauge, description: "Identitas, lokasi, dan pemilik alat." },
    { key: "jenis-sertifikat", icon: BadgeCheck, description: "Daftar jenis sertifikat yang digunakan." },
    { key: "layanan", icon: Layers, description: "Katalog layanan sertifikasi." },
  ] },
];

export default async function MasterOverview({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const context = await requireActiveUser(), params = await searchParams;
  const branch = activeBranch(context.scopes, context.profile.branch_code, params.branch);
  return <>
    <PageHeader title="Master Data" description="Referensi organisasi, tim, sertifikat, dan peralatan."
      actions={<span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-900">Cabang {branch}</span>}/>
    <div className="space-y-4">
      {groups.map(group => {
        const visible = group.items.filter(item => MASTER_KEYS.includes(item.key) && hasPermission(context.scopes, branch, ENTITIES[item.key].readRoles));
        if (!visible.length) return null;
        return <section key={group.title} aria-label={group.title}>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{group.title}</h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {visible.map(({ key, icon: Icon, description }) => {
              const entity = ENTITIES[key], writable = !entity.readonly && hasPermission(context.scopes, branch, entity.writeRoles);
              return <Link key={key} href={`${key === "kalibrasi-alat" ? "/master-data/alat" : entity.path}?branch=${branch}`}
                className="valida-master-card flex min-w-0 items-start gap-3 rounded-xl border border-border bg-white p-3 text-brand-navy shadow-sm focus-visible:outline-primary-hover">
                <span data-card-icon className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-800"><Icon size={18} aria-hidden="true"/></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-bold leading-snug">{key === "kalibrasi-alat" ? "Alat" : entity.title}</h3><ArrowUpRight size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-primary"/></div>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{description}</p>
                  <span data-access-label className={"mt-1.5 inline-block text-[10px] font-semibold " + (writable ? "text-teal-800" : "text-slate-500")}>{writable ? "Kelola" : "Baca"}</span>
                </div>
              </Link>;
            })}
          </div>
        </section>;
      })}
    </div>
    <details className="mt-4 rounded-lg border border-border bg-white px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer font-semibold text-brand-navy">Tentang data & akses</summary>
      <p className="mt-2 leading-snug">Data mengikuti akses cabang, peran, dan portofolio Anda. Direktori pegawai dan kontak tidak membuat akun login. Rujukan regulasi mengikuti sumber yang telah diverifikasi.</p>
    </details>
    <DirectoryAccessMatrix branch={branch}/>
  </>;
}
