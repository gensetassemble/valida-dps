import { ScrollMore } from "@/components/ui/scroll-more";
import { AccessDenied } from "@/components/ui/access-denied";
import { AutoFilterForm } from "@/components/ui/auto-filter-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { importPageContext } from "@/features/imports/server";
import { ReviewForm, ImportReference } from "@/features/imports/forms";
import { reviewRow, commitBatch } from "@/features/imports/actions";
import {
  DOMAIN_LABELS,
  FIELDS,
  type ImportDomain,
} from "@/features/imports/normalize";
const reviewLabels: Record<string, string> = {
  ready: "Siap Ditinjau",
  needs_review: "Perlu Verifikasi",
  invalid: "Tidak Valid",
  duplicate: "Duplikat",
  conflict: "Konflik",
};
const decisionLabels: Record<string, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
  committed: "Diimpor",
};
const choiceFields: Record<string, [string, string][]> = {
  validity_kind: [
    ["term", "Berjangka"],
    ["lifetime", "Seumur Hidup"],
  ],
  employment_category: [
    ["PT", "PT"],
    ["PTT_REGULAR", "PTT Regular"],
    ["PTT_PROJECT", "PTT Project"],
    ["LS", "LS"],
  ],
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    branch?: string;
    page?: string;
    decision?: string;
    status?: string;
  }>;
}) {
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const p = await searchParams,
    c = await importPageContext(p.branch);
  if (!c) return <AccessDenied />;
  const page = Math.max(1, Math.min(125, Number(p.page) || 1));
  const { data: batch } = await c.db
    .from("import_batches")
    .select("*")
    .eq("id", id)
    .eq("branch_code", c.branch)
    .maybeSingle();
  if (!batch) notFound();
  const domain = batch.domain as ImportDomain;
  let q = c.db
    .from("import_rows")
    .select("*", { count: "exact" })
    .eq("batch_id", id);
  if (
    ["pending", "approved", "rejected", "committed"].includes(p.decision || "")
  )
    q = q.eq("decision", p.decision!);
  if (
    ["ready", "needs_review", "invalid", "duplicate", "conflict"].includes(
      p.status || "",
    )
  )
    q = q.eq("review_status", p.status!);
  const [{ data: rows, count, error }, counts] = await Promise.all([
    q
      .order("source_row")
      .order("id")
      .range(0, page * 20 - 1),
    Promise.all(
      ["pending", "approved", "rejected", "committed"].map(async (decision) => {
        const { count } = await c.db
          .from("import_rows")
          .select("id", { count: "exact", head: true })
          .eq("batch_id", id)
          .eq("decision", decision);
        return [decision, count || 0] as const;
      }),
    ),
  ]);
  if (error) throw Error("Baris staging belum dapat dimuat.");
  const stat = Object.fromEntries(counts);
  const refs: Record<string, [string, string]> = {
    employee_id: ["kompetensi-personil", "employee_id"],
    equipment_id: ["riwayat-kalibrasi", "equipment_id"],
    client_id: ["sertifikat-klien", "client_id"],
    certificate_type_id: [
      domain === "clients" ? "sertifikat-klien" : "kompetensi-personil",
      "certificate_type_id",
    ],
  };
  const pageHref = (n: number) =>
    "/impor-data/" +
    id +
    "?" +
    new URLSearchParams({
      branch: c.branch,
      page: String(n),
      ...(p.decision ? { decision: p.decision } : {}),
      ...(p.status ? { status: p.status } : {}),
    });
  return (
    <>
      <Link
        className="text-xs underline"
        href={"/impor-data?branch=" + c.branch}
      >
        ← Daftar batch
      </Link>
      <PageHeader
        title={String(batch.filename)}
        description={
          DOMAIN_LABELS[domain] + " · Staging privat cabang " + c.branch
        }
      />
      <Card className="mb-4 p-5">
        <div className="grid gap-3 text-xs sm:grid-cols-5">
          {[
            ["Sumber", batch.source_count],
            ["Menunggu", stat.pending],
            ["Disetujui", stat.approved],
            ["Ditolak", stat.rejected],
            ["Diimpor", stat.committed],
          ].map(([label, n]) => (
            <div key={String(label)}>
              <p className="text-muted-foreground">{label}</p>
              <strong className="mt-1 block text-xl tabular-nums">
                {String(n)}
              </strong>
            </div>
          ))}
        </div>
        <p className="mt-4 break-all text-[11px] text-muted-foreground">
          SHA-256: {String(batch.file_hash)}. {String(batch.source_note || "")}
        </p>
        <a
          className="mt-3 inline-block text-xs underline"
          href={"/api/imports/errors?batch=" + id + "&branch=" + c.branch}
        >
          Ekspor hasil review XLSX
        </a>
      </Card>
      <Card className="mb-5 p-5">
        <h2 className="mb-3 text-sm font-bold">Impor Baris yang Disetujui</h2>
        <p className="mb-3 text-xs leading-6">
          Target: development · {c.branch}. Hanya {stat.approved} baris yang
          telah disetujui. Transaksi batal seluruhnya bila ada konflik;
          dokumen/hasil kalibrasi tetap menunggu verifikasi resmi. Tidak
          mengaktifkan akun pegawai.
        </p>
        <ReviewForm action={commitBatch}>
          <input type="hidden" name="batch" value={id} />
          <input type="hidden" name="branch" value={c.branch} />
          <label className="block text-xs">
            Ketik IMPOR DPS DEVELOPMENT
            <Input name="confirmation" required className="mt-1 max-w-sm" />
          </label>
          <Button disabled={!stat.approved}>Impor Baris yang Disetujui</Button>
        </ReviewForm>
      </Card>
      <AutoFilterForm className="mb-5 flex flex-wrap gap-3">
        <input type="hidden" name="branch" value={c.branch} />
        <label className="text-xs">
          Keputusan
          <select
            name="decision"
            defaultValue={p.decision || ""}
            className="ml-2 h-9 rounded border border-input"
          >
            <option value="">Semua</option>
            <option value="pending">Menunggu</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
            <option value="committed">Diimpor</option>
          </select>
        </label>
        <label className="text-xs">
          Hasil validasi
          <select
            name="status"
            defaultValue={p.status || ""}
            className="ml-2 h-9 rounded border border-input"
          >
            <option value="">Semua</option>
            {[
              ["ready", "Siap Ditinjau"],
              ["needs_review", "Perlu Verifikasi"],
              ["invalid", "Tidak Valid"],
              ["duplicate", "Duplikat"],
              ["conflict", "Konflik"],
            ].map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </AutoFilterForm>
      <div className="space-y-4">
        {rows?.map((row) => {
          const n = row.normalized_values as Record<string, string>;
          return (
            <Card key={String(row.id)} className="p-5">
              <h2 className="text-sm font-bold">
                {String(row.source_sheet)} · baris {String(row.source_row)}
              </h2>
              <p className="my-2 text-xs">
                {reviewLabels[String(row.review_status)]} · keputusan{" "}
                {decisionLabels[String(row.decision)]}
              </p>
              <ul className="mb-3 list-disc pl-5 text-xs text-amber-900">
                {(row.issues as string[]).map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
              <details className="mb-4">
                <summary className="cursor-pointer text-xs font-semibold">
                  Nilai sumber asli
                </summary>
                <dl className="mt-3 grid max-h-72 gap-2 overflow-auto text-[11px] sm:grid-cols-2">
                  {Object.entries(row.raw_values as Record<string, string>).map(
                    ([key, value]) => (
                      <div key={key}>
                        <dt className="font-semibold">{key}</dt>
                        <dd className="break-all text-muted-foreground">
                          {value || "—"}
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              </details>
              {row.decision === "committed" ? (
                <p className="text-xs text-emerald-800">
                  Sudah diimpor; ID {String(row.committed_record_id)}. Sumber
                  tetap tersimpan.
                </p>
              ) : (
                <ReviewForm action={reviewRow}>
                  <input type="hidden" name="row" value={String(row.id)} />
                  <input type="hidden" name="batch" value={id} />
                  <input type="hidden" name="branch" value={c.branch} />
                  <input type="hidden" name="domain" value={domain} />
                  <div className="grid gap-4 md:grid-cols-2">
                    {Object.entries(FIELDS[domain]).map(([key, label]) =>
                      refs[key] ? (
                        <ImportReference
                          key={String(row.id) + key}
                          name={key}
                          label={label}
                          entity={refs[key][0]}
                          field={refs[key][1]}
                          branch={c.branch}
                          value={n[key] || ""}
                        />
                      ) : (
                        <label key={key} className="text-xs">
                          {label}
                          {choiceFields[key] ? (
                            <select
                              name={key}
                              defaultValue={n[key] || ""}
                              className="mt-1 h-10 w-full rounded-lg border border-input px-3"
                            >
                              <option value="">Belum dipilih</option>
                              {choiceFields[key].map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              className="mt-1"
                              name={key}
                              defaultValue={n[key] || ""}
                              maxLength={4000}
                            />
                          )}
                        </label>
                      ),
                    )}
                  </div>
                  <label className="block text-xs">
                    Alasan keputusan
                    <Input
                      className="mt-1"
                      name="reason"
                      required
                      minLength={8}
                      maxLength={1000}
                      defaultValue={String(row.review_note || "")}
                    />
                  </label>
                  <label className="block text-xs">
                    <input type="checkbox" name="confirmed" /> Saya telah
                    memeriksa identitas, referensi dan koreksi baris ini.
                  </label>
                  <div className="flex gap-3">
                    <Button name="decision" value="approve">
                      Setujui baris
                    </Button>
                    <Button name="decision" value="reject" variant="outline">
                      Tolak baris
                    </Button>
                  </div>
                </ReviewForm>
              )}
            </Card>
          );
        })}
      </div>
      {!rows?.length && (
        <Card className="p-5">Tidak ada baris sesuai filter.</Card>
      )}
      <p className="mt-4 text-xs">
        {rows?.length || 0} dari {count || 0} baris sesuai filter
      </p>
      <ScrollMore
        href={pageHref(page + 1)}
        shown={rows?.length || 0}
        total={count || 0}
      />
    </>
  );
}
