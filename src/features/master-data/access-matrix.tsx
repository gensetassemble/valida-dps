import { ALL_ROLES, ROLE_LABELS, hasPermission } from "@/lib/auth/permissions";
import { ENTITIES } from "./registry";

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
      className="mt-6 rounded-xl border border-border bg-white p-4 text-xs"
    >
      <summary className="cursor-pointer text-sm font-bold">
        Matriks akses peran · {branch}
      </summary>
      <p className="my-3 leading-6 text-muted-foreground">
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
      <ul className="mt-3 space-y-2 leading-6 text-muted-foreground">
        <li>
          IT Officer/Admin: mengelola data cabang. Arsip/pemulihan dan
          verifikasi cepat nama pegawai hanya untuk IT Officer.
        </li>
        <li>
          PTK: mengelola alat dalam portofolio tugasnya. PTK dan QSHE saat ini
          ditugaskan pada seluruh 10 portofolio DPS.
        </li>
        <li>
          Koordinator Operasional: membaca alat dan kompetensi pada
          portofolionya; mengajukan kalibrasi tanpa mengubah master alat.
        </li>
        <li>
          AM: mengubah pelanggan/sertifikat yang ditugaskan. HRGA: mengelola
          direktori dan kompetensi personil cabang.
        </li>
        <li>
          Personil: membaca sertifikat sendiri. Kepala Bidang, Kepala UP, Kepala
          Cabang dan Tester: membaca data cabang sesuai peran.
        </li>
        <li>
          Direktori ini tidak membuat akun, menambah peran, atau memperluas
          cakupan akses.
        </li>
      </ul>
    </details>
  );
}
