import { AccessDenied } from "@/components/ui/access-denied";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { pageEntityContext, masterClient } from "@/features/master-data/server";
import { validityLabel } from "@/lib/domain/validity";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; page?: string; q?: string }>;
}) {
  const p = await searchParams,
    c = await pageEntityContext("kompetensi-personil", p.branch),
    db = await masterClient();
  const page = Math.max(1, Math.min(1000, Number(p.page) || 1));
  if (!c) return <AccessDenied />;
  let q = db
    .from("employee_directory")
    .select("id,full_name,npp", { count: "exact" })
    .eq("branch_code", c.branch);
  if (p.q)
    q = q.ilike(
      "full_name",
      "%" + p.q.replace(/[%_*]/g, "").slice(0, 100) + "%",
    );
  const {
    data: employees,
    count,
    error,
  } = await q
    .order("full_name")
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  if (error) throw Error("Matriks belum dapat dimuat.");
  const ids = (employees || []).map((e) => String(e.id));
  const { data: certs } = ids.length
    ? await db
        .from("personnel_certificate_records")
        .select(
          "id,employee_id,certificate_type_id,certificate_type_name,original_title,expiry_date,verification_status,validity_kind",
        )
        .in("employee_id", ids)
        .eq("is_active", true)
        .limit(501)
    : { data: [] };
  if ((certs?.length || 0) > 500)
    throw Error("Terlalu banyak bukti pada halaman ini; gunakan filter nama.");
  const types = [
    ...new Map(
      (certs || []).map((r) => [
        String(r.certificate_type_id),
        String(r.certificate_type_name),
      ]),
    ).entries(),
  ];
  return (
    <>
      <PageHeader
        title="Matriks Kompetensi"
        description="Satu identitas pegawai, beberapa lisensi terpisah. Lifetime tidak termasuk ringkasan kedaluwarsa."
      />
      <form className="mb-4 flex gap-3">
        <input type="hidden" name="branch" value={c.branch} />
        <input
          aria-label="Cari nama pegawai"
          name="q"
          defaultValue={p.q}
          className="h-10 rounded-lg border border-input px-3"
          placeholder="Cari nama pegawai"
        />
        <button className="text-sm underline">Cari</button>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="p-4">Pegawai / NPP</th>
              {types.map(([id, name]) => (
                <th key={id} className="p-4">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees?.map((e) => (
              <tr key={String(e.id)} className="border-b">
                <th className="p-4">
                  {String(e.full_name)}
                  <span className="mt-1 block font-normal text-muted-foreground">
                    {String(e.npp || "NPP belum diketahui")}
                  </span>
                </th>
                {types.map(([type]) => (
                  <td key={type} className="p-4">
                    {(certs || [])
                      .filter(
                        (r) =>
                          r.employee_id === e.id &&
                          r.certificate_type_id === type,
                      )
                      .map((r) => (
                        <Link
                          key={String(r.id)}
                          className="mb-3 block"
                          href={
                            "/kompetensi-personil/" +
                            r.id +
                            "?branch=" +
                            c.branch
                          }
                        >
                          <span className="mb-1 block underline">
                            {String(
                              r.original_title || r.certificate_type_name,
                            )}
                          </span>
                          <StatusBadge
                            value={validityLabel(
                              r.expiry_date,
                              r.verification_status === "verified",
                              r.validity_kind === "lifetime",
                            )}
                          />
                        </Link>
                      ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!employees?.length && <p className="p-5">Belum ada data.</p>}
      </Card>
      <div className="mt-4 flex gap-4 text-xs">
        <span>{count || 0} pegawai sesuai akses</span>
        {page > 1 && (
          <Link href={"?branch=" + c.branch + "&page=" + (page - 1)}>
            Sebelumnya
          </Link>
        )}
        {page * 20 < (count || 0) && (
          <Link href={"?branch=" + c.branch + "&page=" + (page + 1)}>
            Berikutnya
          </Link>
        )}
      </div>
    </>
  );
}
