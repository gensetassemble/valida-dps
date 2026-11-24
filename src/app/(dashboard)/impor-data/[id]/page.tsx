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
import { reviewRow, commitBatch, importAuthorizedClientWorkbook, approvePersonnelBatch } from "@/features/imports/actions";
import { approvedClientWorkbook } from "@/features/imports/client-workbook-batch";
import {
  DOMAIN_LABELS,
  FIELDS,
  type ImportDomain,
} from "@/features/imports/normalize";
const reviewLabels: Record<string, string> = {
  ready: "Siap diterapkan",
  needs_review: "Perlu diperiksa",
  invalid: "Perlu diperbaiki",
  duplicate: "Dilewati (data ganda)",
  conflict: "Ada data yang berbeda",
};
const decisionLabels: Record<string, string> = {
  pending: "Belum diperiksa",
  approved: "Akan diterapkan",
  rejected: "Diabaikan",
  committed: "Sudah diterapkan",
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
  change_reason: [
    ["new_certificate", "Sertifikat baru / perpanjangan"],
    ["data_correction", "Koreksi data, bukan sertifikat baru"],
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
  if (error) throw Error("Hasil pemeriksaan file belum dapat dimuat.");
  const clientIds =
    domain === "clients"
      ? [
          ...new Set(
            (rows || [])
              .map(
                (row) =>
                  (row.normalized_values as Record<string, string>).client_id,
              )
              .filter(Boolean),
          ),
        ]
      : [];
  const { data: currentClientCertificates } = clientIds.length
    ? await c.db
        .from("client_certificates")
        .select(
          "id,client_id,certificate_type_id,certificate_number,issue_date,expiry_date",
        )
        .eq("branch_code", c.branch)
        .in("client_id", clientIds)
        .limit(500)
    : { data: [] };
  const identity = (value: unknown) =>
    String(value || "")
      .toLocaleLowerCase("id")
      .replace(/[^a-z0-9]/g, "");
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
        ← Riwayat impor
      </Link>
      <PageHeader
        title={String(batch.filename)}
        description={
          DOMAIN_LABELS[domain] + " · Hasil pemeriksaan sementara · Cabang " + c.branch
        }
      />
      <Card className="mb-4 p-5">
        <div className="grid gap-3 text-xs sm:grid-cols-5">
          {[
            ["Baris file", batch.source_count],
            ["Belum diperiksa", stat.pending],
            ["Akan diterapkan", stat.approved],
            ["Diabaikan", stat.rejected],
            ["Sudah diterapkan", stat.committed],
          ].map(([label, n]) => (
            <div key={String(label)}>
              <p className="text-muted-foreground">{label}</p>
              <strong className="mt-1 block text-xl tabular-nums">
                {String(n)}
              </strong>
            </div>
          ))}
        </div>
        <a
          className="mt-3 inline-block text-xs underline"
          href={"/api/imports/errors?batch=" + id + "&branch=" + c.branch}
        >
          Unduh hasil pemeriksaan
        </a>
      </Card>
      <Card className="mb-5 p-5">
        {domain === "personnel" && stat.pending > 0 && (
          <div className="mb-5 rounded-lg border border-teal-200 bg-teal-50 p-4">
            <h2 className="text-sm font-bold text-brand-navy">Sertakan semua baris yang siap</h2>
            <p className="my-3 text-xs leading-6 text-teal-900">
              Baris yang sudah cocok dapat disetujui sekaligus. Baris yang perlu diperbaiki tetap tidak akan diterapkan.
            </p>
            <ReviewForm action={approvePersonnelBatch}>
              <input type="hidden" name="batch" value={id} />
              <input type="hidden" name="branch" value={c.branch} />
              <label className="block text-xs">
                <input type="checkbox" name="confirmed" required /> Saya sudah memeriksa ringkasan dan ingin menyertakan semua baris yang siap.
              </label>
              <Button>Sertakan semua yang siap</Button>
            </ReviewForm>
          </div>
        )}
        {approvedClientWorkbook(batch) && <div className="mb-5 rounded-lg border border-border p-4">
          <h2 className="text-sm font-bold">Pembaruan sertifikat klien</h2>
          <p className="my-3 text-xs leading-6">19 sertifikat untuk 11 perusahaan, portofolio IND, PIK, dan KSP. Pastikan seluruh data di bawah sudah sesuai. PIC [UJI] Adli Alfian adalah penerima internal pengujian. Penerapan perubahan dicatat atas akun AM/Marketing/PDOS yang sedang masuk.</p>
          <ReviewForm action={importAuthorizedClientWorkbook}>
            <input type="hidden" name="batch" value={id} />
            <input type="hidden" name="branch" value={c.branch} />
            <label className="block text-xs"><input type="checkbox" name="confirmed" required /> Saya telah memeriksa 19 baris dan memastikan datanya sesuai.</label>
            <label className="block text-xs">Ketik TERAPKAN 19 SERTIFIKAT KLIEN<Input name="confirmation" required className="mt-1 max-w-md" /></label>
            <Button disabled={stat.committed === 19}>Terapkan 19 sertifikat</Button>
          </ReviewForm>
        </div>}
        {!approvedClientWorkbook(batch) && <><h2 className="mb-3 text-sm font-bold">Terapkan Pembaruan</h2>
        <p className="mb-3 text-xs leading-6">
          {stat.approved} baris siap diterapkan ke {domain === "clients" ? "data sertifikat klien" : "data uji"} cabang {c.branch}. Jika ada data yang bertentangan, tidak ada perubahan yang disimpan. Dokumen resmi tetap diperiksa melalui proses terpisah dan akun pegawai tidak diaktifkan otomatis.
        </p>
        <ReviewForm action={commitBatch}>
          <input type="hidden" name="batch" value={id} />
          <input type="hidden" name="branch" value={c.branch} />
          <label className="block text-xs">
            Ketik TERAPKAN PEMBARUAN
            <Input name="confirmation" required className="mt-1 max-w-sm" />
          </label>
          <Button disabled={!stat.approved}>Terapkan pembaruan</Button>
        </ReviewForm>
        </>}
      </Card>
      <AutoFilterForm className="mb-5 flex flex-wrap gap-3">
        <input type="hidden" name="branch" value={c.branch} />
        <label className="text-xs">
          Status penerapan
          <select
            name="decision"
            defaultValue={p.decision || ""}
            className="ml-2 h-9 rounded border border-input"
          >
            <option value="">Semua</option>
            <option value="pending">Belum diperiksa</option>
            <option value="approved">Akan diterapkan</option>
            <option value="rejected">Diabaikan</option>
            <option value="committed">Sudah diterapkan</option>
          </select>
        </label>
        <label className="text-xs">
          Hasil pemeriksaan
          <select
            name="status"
            defaultValue={p.status || ""}
            className="ml-2 h-9 rounded border border-input"
          >
            <option value="">Semua</option>
            {[
              ["ready", "Siap diterapkan"],
              ["needs_review", "Perlu diperiksa"],
              ["invalid", "Perlu diperbaiki"],
              ["duplicate", "Dilewati (data ganda)"],
              ["conflict", "Ada data yang berbeda"],
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
          const oldCertificateNumber =
            n.existing_certificate_number || n.certificate_number;
          const currentClientCertificate = currentClientCertificates?.find(
            (certificate) =>
              certificate.client_id === n.client_id &&
              certificate.certificate_type_id === n.certificate_type_id &&
              identity(certificate.certificate_number) ===
                identity(oldCertificateNumber),
          );
          return (
            <Card key={String(row.id)} className="p-5">
              <h2 className="text-sm font-bold">
                {String(row.source_sheet)} · baris {String(row.source_row)}
              </h2>
              <p className="my-2 text-xs">
                {reviewLabels[String(row.review_status)]} · status{" "}
                {decisionLabels[String(row.decision)]}
              </p>
              <ul className="mb-3 list-disc pl-5 text-xs text-amber-900">
                {(row.issues as string[]).map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
              <details className="mb-4">
                <summary className="cursor-pointer text-xs font-semibold">
                  Data dari file
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
                  Sudah diterapkan; nomor pencatatan {String(row.committed_record_id)}.
                </p>
              ) : (
                <ReviewForm action={reviewRow}>
                  <input type="hidden" name="row" value={String(row.id)} />
                  <input type="hidden" name="batch" value={id} />
                  <input type="hidden" name="branch" value={c.branch} />
                  <input type="hidden" name="domain" value={domain} />
                  {domain === "clients" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs">
                      <p className="font-semibold text-amber-950">
                        Perubahan nomor dan tanggal
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        {[
                          [
                            "Nomor sertifikat",
                            currentClientCertificate?.certificate_number,
                            n.certificate_number,
                          ],
                          [
                            "Tanggal terbit",
                            currentClientCertificate?.issue_date,
                            n.issue_date,
                          ],
                          [
                            "Tanggal berakhir",
                            currentClientCertificate?.expiry_date,
                            n.expiry_date,
                          ],
                        ].map(([label, before, after]) => (
                          <div key={String(label)}>
                            <span className="font-semibold">{label}</span>
                            <span className="mt-1 block text-amber-900">
                              {String(before || "Belum tercatat")} →{" "}
                              {String(after || "Dikosongkan")}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-amber-900">
                        Tentukan apakah perubahan ini merupakan sertifikat baru / perpanjangan atau hanya koreksi data.
                      </p>
                    </div>
                  )}
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
                    Catatan pemeriksaan
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
                    <input type="checkbox" name="confirmed" /> Saya telah memeriksa baris ini dan datanya sudah sesuai.
                  </label>
                  <div className="flex gap-3">
                    <Button name="decision" value="approve">
                      Sertakan perubahan
                    </Button>
                    <Button name="decision" value="reject" variant="outline">
                      Abaikan perubahan
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
