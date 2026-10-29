import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { masterClient, type QueryParams } from "@/features/master-data/server";
export async function OperationalFilters({
  entity,
  branch,
  params,
  clearPath,
}: {
  entity: string;
  branch: string;
  params: QueryParams;
  clearPath?: string;
}) {
  const db = await masterClient();
  const keys =
    entity === "sertifikat-klien"
      ? [
          ["client", "clients", "name", "Pelanggan"],
          ["area", "work_areas", "name", "Wilayah"],
          ["am", "profiles", "full_name", "Account Manager"],
          ["portfolio", "portfolios", "code", "Portofolio"],
          ["type", "certificate_types", "name", "Jenis sertifikat"],
        ]
      : entity === "kompetensi-personil"
        ? [
            ["employee", "employee_directory", "full_name", "Pegawai"],
            ["portfolio", "portfolios", "code", "Portofolio"],
            ["type", "certificate_types", "name", "Jenis kompetensi"],
          ]
        : [["portfolio", "portfolios", "code", "Portofolio"]];
  const options = await Promise.all(
    keys.map(async ([param, table, label, title]) => {
      let q = db
        .from(table)
        .select("id," + label)
        .eq("branch_code", branch)
        .order(label)
        .limit(100);
      if (table === "certificate_types")
        q = q.eq(
          "category",
          entity === "sertifikat-klien" ? "client" : "personnel",
        );
      const { data } = await q;
      return {
        param,
        title,
        label,
        rows: (data || []) as unknown as Record<string, string>[],
      };
    }),
  );
  return (
    <Card className="mb-4 p-4">
      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="branch" value={branch} />
        {params.q && <input type="hidden" name="q" value={params.q} />}
        {entity === "kompetensi-personil" && (
          <label className="text-xs">
            Jenis masa berlaku
            <select
              name="kind"
              defaultValue={params.kind || ""}
              className="mt-1 block h-10 rounded-lg border border-input px-2"
            >
              <option value="">Semua jenis</option>
              <option value="term">Berjangka</option>
              <option value="lifetime">
                Seumur hidup (semua status verifikasi)
              </option>
            </select>
          </label>
        )}
        {entity === "kalibrasi-alat" && (
          <label className="text-xs">
            Kelayakan alat
            <select
              name="eligibility"
              defaultValue={params.eligibility || ""}
              className="mt-1 block h-10 rounded-lg border border-input px-2"
            >
              <option value="">Semua kelayakan</option>
              {[
                "Layak Pakai",
                "Tidak Layak Pakai",
                "Perlu Verifikasi",
                "Kalibrasi Terbaru Belum Diverifikasi",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs">
          Masa berlaku
          <select
            name="validity"
            defaultValue={params.validity || ""}
            className="mt-1 block h-10 rounded-lg border border-input bg-white px-2"
          >
            <option value="">Semua status</option>
            {[
              "Kedaluwarsa",
              "Kritis",
              "Perhatian",
              "Pantau",
              "Aman",
              "Perlu Verifikasi",
              "Berlaku Seumur Hidup",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        {options.map((o) => (
          <label className="text-xs" key={o.param}>
            {o.title}
            <select
              name={o.param}
              defaultValue={params[o.param as keyof QueryParams] || ""}
              className="mt-1 block h-10 max-w-48 rounded-lg border border-input bg-white px-2"
            >
              <option value="">Semua</option>
              {o.rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r[o.label]}
                </option>
              ))}
            </select>
          </label>
        ))}
        {params.category && (
          <input type="hidden" name="category" value={params.category} />
        )}{" "}
        {params.examples && (
          <input type="hidden" name="examples" value={params.examples} />
        )}
        <label className="text-xs">
          Akhir mulai
          <input
            type="date"
            name="from"
            defaultValue={params.from}
            className="mt-1 block h-10 rounded-lg border border-input px-2"
          />
        </label>
        <label className="text-xs">
          Akhir sampai
          <input
            type="date"
            name="until"
            defaultValue={params.until}
            className="mt-1 block h-10 rounded-lg border border-input px-2"
          />
        </label>
        <Button variant="outline">Terapkan filter</Button>
        <Link
          href={(clearPath || "/" + entity) + "?branch=" + branch}
          className="text-xs underline"
        >
          Hapus filter
        </Link>
      </form>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Pilihan referensi dibatasi 100 sesuai akses. Gunakan pencarian tabel
        untuk mempersempit data.
      </p>
    </Card>
  );
}
