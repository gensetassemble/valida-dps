import { ALL_ROLES, ROLE_LABELS, hasPermission } from "@/lib/auth/permissions";
import { ENTITIES } from "./registry";
import { ShieldCheck, Wrench, ClipboardCheck, Network, Contact, Users, BadgeCheck, Building2, Info } from "lucide-react";

const roleGuides = [
  { title: "Super Admin & Admin", icon: ShieldCheck, tone: "bg-blue-50 text-blue-800", description: "Kelola data cabang. Arsip, pemulihan, dan verifikasi cepat pegawai khusus Super Admin." },
  { title: "PTK", icon: Wrench, tone: "bg-teal-50 text-teal-800", description: "Kelola alat dan kalibrasi dalam portofolio yang ditugaskan." },
  { title: "QSHE", icon: ClipboardCheck, tone: "bg-violet-50 text-violet-800", description: "Baca seluruh kalibrasi dan kompetensi personil cabang, lalu beri catatan QC tanpa mengubah sertifikat." },
  { title: "Koordinator Operasional", icon: Network, tone: "bg-cyan-50 text-cyan-800", description: "Baca alat dan kompetensi sesuai penetapan portofolio aktif. Akun harus terhubung ke pegawai yang ditetapkan." },
  { title: "AM / Marketing", icon: Contact, tone: "bg-amber-50 text-amber-800", description: "Kelola pelanggan dan sertifikat dalam cakupan penugasannya." },
  { title: "HRGA", icon: Users, tone: "bg-emerald-50 text-emerald-800", description: "Kelola direktori pegawai dan kompetensi personil cabang." },
  { title: "Personil", icon: BadgeCheck, tone: "bg-indigo-50 text-indigo-800", description: "Lihat sertifikat kompetensi milik sendiri." },
  { title: "Pimpinan & Tester", icon: Building2, tone: "bg-slate-100 text-slate-700", description: "Kepala Cabang, Kepala Bidang, Kepala UP, dan Tester membaca data cabang sesuai peran." },
];

const columns = [
  ["kalibrasi-alat", "Alat"],
  ["pegawai", "Pegawai"],
  ["kompetensi-personil", "Kompetensi"],
  ["sertifikat-klien", "Sertifikat klien"],
  ["portofolio", "Portofolio"],
] as const;

export function DirectoryAccessMatrix({ branch }: { branch: string }) {
  return (
    <details
      id="matriks-akses"
      className="mt-4 rounded-xl border border-border bg-white p-3 text-xs"
    >
      <summary className="cursor-pointer text-sm font-bold">
        Matriks akses peran · {branch}
      </summary>
      <p className="my-2 leading-snug text-muted-foreground">
        Tambah/ubah berarti dapat mengelola data dalam cakupan penugasannya.
        Baca tidak memberi izin perubahan. Akun dengan beberapa peran memperoleh
        gabungan hak yang sah; pembatasan cabang, portofolio, dan pemilik data
        tetap berlaku.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Hak akses peran pada direktori dan modul VALIDA
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="p-3">
                Peran
              </th>
              {columns.map(([key, label]) => (
                <th scope="col" className="p-3" key={key}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_ROLES.map((role) => {
              const scopes = [{ branch_code: branch, role_code: role }];
              return (
                <tr key={role} className="border-b border-border last:border-0">
                  <th scope="row" className="p-3 font-semibold">
                    {ROLE_LABELS[role]}
                  </th>
                  {columns.map(([key]) => {
                    const e = ENTITIES[key];
                    const write =
                      !e.readonly &&
                      hasPermission(scopes, branch, e.writeRoles);
                    const read = hasPermission(scopes, branch, e.readRoles);
                    return (
                      <td
                        className={
                          "p-3 " +
                          (write
                            ? "font-semibold text-emerald-800"
                            : read
                              ? "text-brand-navy"
                              : "text-muted-foreground")
                        }
                        key={key}
                      >
                        {write
                          ? "Tambah / ubah"
                          : read
                            ? "Baca"
                            : "Tidak tersedia"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <section aria-label="Ringkasan akses per peran" className="mt-3 border-t border-border pt-3">
        <h3 className="mb-2 text-xs font-bold text-brand-navy">Peran & tanggung jawab</h3>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {roleGuides.map(({ title, icon: Icon, tone, description }) => (
            <div key={title} className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${tone}`}><Icon size={16} aria-hidden="true"/></span>
              <div className="min-w-0">
                <h4 className="text-xs font-bold leading-snug text-brand-navy">{title}</h4>
                <p className="mt-1 text-[11px] leading-snug text-slate-600">{description}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground"><Info size={13} className="mt-0.5 shrink-0" aria-hidden="true"/>Direktori menyimpan identitas. Akun login dan peran dikelola melalui Pengaturan.</p>
      </section>
    </details>
  );
}
