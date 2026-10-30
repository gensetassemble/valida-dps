"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
const names: Record<string, string> = {
  dashboard: "Dashboard",
  "master-data": "Master Data",
  cabang: "Cabang",
  wilayah: "Wilayah Kerja",
  portofolio: "Portofolio",
  pegawai: "Direktori Pegawai",
  "koordinator-operasional": "Koordinator Operasional",
  "jenis-sertifikat": "Jenis Sertifikat",
  layanan: "Jenis Layanan",
  pelanggan: "Pelanggan",
  pengaturan: "Pengaturan",
  pengguna: "Pengguna",
  roles: "Peran",
  profil: "Profil Saya",
  audit: "Audit Trail",
  "sertifikat-klien": "Sertifikat Klien",
  "kompetensi-personil": "Kompetensi Personil",
  "kalibrasi-alat": "Kalibrasi Alat",
  "peristiwa-kalibrasi": "Peristiwa Kalibrasi",
  "pipeline-perpanjangan": "Pipeline Perpanjangan",
  "impor-data": "Impor Data",
  baru: "Tambah",
  ubah: "Ubah",
  matriks: "Matriks",
  kalibrasi: "Kalibrasi",
};
export function Breadcrumbs() {
  const parts = usePathname().split("/").filter(Boolean);
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-2 text-xs"
    >
      {parts.map((part, index) => {
        const label = names[part] || "Detail";
        const last = index === parts.length - 1;
        const href = "/" + parts.slice(0, index + 1).join("/");
        return (
          <span key={href} className="flex min-w-0 items-center gap-2">
            {index > 0 && (
              <ChevronRight
                size={13}
                aria-hidden
                className="shrink-0 text-muted-foreground"
              />
            )}
            {last ? (
              <span
                aria-current="page"
                className="truncate font-semibold text-brand-navy"
              >
                {label}
              </span>
            ) : (
              <Link
                className="whitespace-nowrap text-muted-foreground hover:text-primary-hover"
                href={href}
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
