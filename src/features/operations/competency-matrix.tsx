import Link from "next/link";
import { AccessDenied } from "@/components/ui/access-denied";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { pageEntityContext, masterClient } from "@/features/master-data/server";
import { operationalValidity } from "@/lib/domain/validity";
import { formatBusinessDate } from "@/lib/format";
import { AutoFilterForm } from "@/components/ui/auto-filter-form";

const colors: Record<string, string> = {
  Expired: "bg-red-50 text-red-800 border-red-200",
  Kritis: "bg-orange-50 text-orange-800 border-orange-200",
  Perhatian: "bg-amber-50 text-amber-800 border-amber-200",
  Pantau: "bg-yellow-50 text-yellow-900 border-yellow-200",
  Aman: "bg-emerald-50 text-emerald-800 border-emerald-200",
  "Berlaku Seumur Hidup": "bg-blue-50 text-blue-800 border-blue-200",
};
export default async function CompetencyMatrix({
  searchParams,
}: {
  searchParams: Promise<{
    branch?: string;
    page?: string;
    q?: string;
    view?: string;
  }>;
}) {
  const p = await searchParams,
    c = await pageEntityContext("kompetensi-personil", p.branch);
  if (!c) return <AccessDenied />;
  const branch = c.branch;
  const db = await masterClient();
  const { data: licenses, error } = await db
    .from("personnel_certificate_records")
    .select(
      "id,employee_id,certificate_type_id,certificate_type_name,original_title,expiry_date,validity_kind",
    )
    .eq("branch_code", c.branch)
    .eq("is_active", true)
    .order("original_title")
    .limit(5001);
  if (error || (licenses?.length || 0) > 5000)
    throw Error(
      "Matriks belum dapat dimuat. Persempit data melalui daftar kompetensi.",
    );
  const employeeIds = [
    ...new Set((licenses || []).map((r) => String(r.employee_id))),
  ];
  const matrix = p.view === "matrix";
  let employees: { id: string; full_name: string; npp: string | null }[] = [],
    total = 0;
  if (employeeIds.length) {
    let query = db
      .from("employee_directory")
      .select("id,full_name,npp", { count: "exact" })
      .eq("branch_code", c.branch)
      .in("id", employeeIds);
    if (p.q)
      query = query.ilike(
        "full_name",
        "%" + p.q.replace(/[%_*]/g, "").slice(0, 100) + "%",
      );
    const r = await query.order("full_name").order("id").limit(5000);
    if (r.error) throw Error("Pegawai pada matriks belum dapat dimuat.");
    employees = r.data || [];
    total = r.count || 0;
  }
  const types = [
    ...new Map(
      (licenses || []).map((r) => [
        String(r.certificate_type_id),
        String(r.certificate_type_name),
      ]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "id"));
  const link = (values: Record<string, string>) =>
    "?" +
    new URLSearchParams({
      branch: c.branch,
      ...(p.q ? { q: p.q } : {}),
      view: matrix ? "matrix" : "compact",
      ...values,
    });
  const grouped = new Map<string, typeof licenses>();
  for (const r of licenses || [])
    grouped.set(String(r.employee_id), [
      ...(grouped.get(String(r.employee_id)) || []),
      r,
    ]);
  function licenseChip(
    r: NonNullable<typeof licenses>[number],
    compact: boolean,
  ) {
    const status = operationalValidity(
      r.expiry_date,
      r.validity_kind === "lifetime",
    );
    const title = String(r.original_title || r.certificate_type_name),
      date =
        r.validity_kind === "lifetime"
          ? "Seumur hidup"
          : formatBusinessDate(r.expiry_date);
    return (
      <Link
        key={String(r.id)}
        href={"/kompetensi-personil/" + r.id + "?branch=" + branch}
        title={title + " · " + status + " · " + date}
        className={
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] leading-4 hover:brightness-95 " +
          (colors[status] || "bg-slate-50 text-slate-600 border-slate-200")
        }
      >
        <span className="size-1.5 shrink-0 rounded-full bg-current" />
        {compact ? (
          <>
            <span className="font-semibold">{title}</span>
            <span className="whitespace-nowrap opacity-80">{date}</span>
          </>
        ) : r.validity_kind === "lifetime" ? (
          "∞"
        ) : (
          date
        )}
      </Link>
    );
  }
  return (
    <>
      <PageHeader
        title="Matriks Kompetensi"
        actions={
          <Link
            className="text-xs underline"
            href={"/kompetensi-personil?branch=" + c.branch}
          >
            Daftar sertifikat
          </Link>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <AutoFilterForm className="flex gap-2">
            <input type="hidden" name="branch" value={c.branch} />
            <input
              type="hidden"
              name="view"
              value={matrix ? "matrix" : "compact"}
            />
            <input
              aria-label="Cari nama pegawai"
              name="q"
              defaultValue={p.q}
              className="h-9 w-52 rounded-lg border border-input px-3 text-xs"
              placeholder="Cari nama pegawai"
            />
            <button className="text-xs font-semibold underline">Cari</button>
          </AutoFilterForm>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs">
            <Link
              aria-current={!matrix ? "page" : undefined}
              className={
                "rounded px-3 py-1.5 " +
                (!matrix ? "bg-white font-semibold shadow-sm" : "")
              }
              href={link({ view: "compact", page: "1" })}
            >
              Ringkas
            </Link>
            <Link
              aria-current={matrix ? "page" : undefined}
              className={
                "rounded px-3 py-1.5 " +
                (matrix ? "bg-white font-semibold shadow-sm" : "")
              }
              href={link({ view: "matrix", page: "1" })}
            >
              Matriks
            </Link>
          </div>
        </div>
        {matrix && (
          <details className="border-b border-border px-4 py-2 text-[11px]">
            <summary className="cursor-pointer">
              Keterangan {types.length} kolom kompetensi
            </summary>
            <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {types.map(([id, name], i) => (
                <p key={id}>
                  <strong>{"K" + String(i + 1).padStart(2, "0")}</strong> ·{" "}
                  {name}
                </p>
              ))}
            </div>
          </details>
        )}
        <div
          className="max-h-[70dvh] max-w-full overflow-auto"
          role="region"
          aria-label="Matriks lisensi pegawai"
          tabIndex={0}
        >
          <table
            className={
              "w-full border-collapse text-left text-xs " +
              (matrix ? "min-w-[800px]" : "")
            }
          >
            <thead className="border-b border-border bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 min-w-48 bg-slate-50 px-4 py-2.5"
                >
                  Pegawai / NPP
                </th>
                {matrix ? (
                  types.map(([id, name], i) => (
                    <th
                      key={id}
                      scope="col"
                      title={name}
                      className="min-w-24 border-l border-border px-2 py-2 text-center text-[10px]"
                    >
                      <abbr title={name} className="cursor-help no-underline">
                        {"K" + String(i + 1).padStart(2, "0")}
                      </abbr>
                    </th>
                  ))
                ) : (
                  <th scope="col" className="px-3 py-2.5">
                    Kompetensi & masa berlaku
                  </th>
                )}
                <th scope="col" className="px-3 py-2.5 text-right">
                  Lisensi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map((e) => {
                const certs = grouped.get(String(e.id)) || [];
                return (
                  <tr key={e.id} className="group hover:bg-slate-50">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-white px-4 py-2.5 font-semibold group-hover:bg-slate-50"
                    >
                      {e.full_name}
                      <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                        {e.npp || "Non-NPP"}
                      </span>
                    </th>
                    {matrix ? (
                      types.map(([type]) => (
                        <td
                          key={type}
                          className="border-l border-border p-1.5 text-center"
                        >
                          <div className="flex flex-col items-center gap-1">
                            {certs
                              .filter((r) => r.certificate_type_id === type)
                              .map((r) => licenseChip(r, false))}
                          </div>
                        </td>
                      ))
                    ) : (
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {certs.map((r) => licenseChip(r, true))}
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {certs.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!employees.length && (
            <p className="p-4 text-xs text-muted-foreground">
              Tidak ada pegawai dengan lisensi sesuai akses dan pencarian.
            </p>
          )}
        </div>
        <div className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
          {total} pegawai dengan lisensi · scroll untuk melihat seluruh daftar
        </div>
      </Card>
    </>
  );
}
