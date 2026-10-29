import { AccessDenied } from "@/components/ui/access-denied";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  pageEntityContext,
  masterClient,
  type DataRow,
} from "@/features/master-data/server";
import { PipelineAction } from "@/features/operations/forms";
import { formatBusinessDate, formatRupiah } from "@/lib/format";
import { remainingDays } from "@/lib/domain/validity";
const BOARD_PAGE_SIZE = 1;
const stages = [
  ["uncontacted", "Belum Dihubungi", "border-t-slate-400"],
  ["contacted", "Dihubungi", "border-t-blue-500"],
  ["offered", "Penawaran Terkirim", "border-t-amber-500"],
  ["po_received", "PO Diterima", "border-t-emerald-500"],
  ["deferred", "Ditunda", "border-t-purple-500"],
  ["not_renewed", "Tidak Diperpanjang", "border-t-pink-500"],
];
function remainingText(value: unknown) {
  const days = typeof value === "string" ? remainingDays(value) : null;
  return days === null
    ? "Tanggal belum diketahui"
    : days < 0
      ? Math.abs(days) + " hari lewat"
      : days + " hari lagi";
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    branch?: string;
    examples?: string;
    [key: string]: string | undefined;
  }>;
}) {
  const p = await searchParams,
    c = await pageEntityContext("sertifikat-klien", p.branch),
    db = await masterClient(),
    include = p.examples !== "false";
  if (!c) return <AccessDenied />;
  const pageFor = (stage: string) =>
    Math.min(1000, Math.max(1, Math.floor(Number(p["page_" + stage]) || 1)));
  const pageLink = (stage: string, page: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(p))
      if (value) query.set(key, value);
    query.set("branch", c.branch);
    query.set("page_" + stage, String(page));
    return "?" + query;
  };
  const [{ data: totals, error }, columns] = await Promise.all([
    db.rpc("pipeline_totals", { b: c.branch, include_examples: include }),
    Promise.all(
      stages.map(async ([stage]) => {
        let q = db
          .from("renewal_board_records")
          .select("*")
          .eq("branch_code", c.branch)
          .eq("stage", stage);
        if (!include) q = q.eq("is_example", false);
        const { data, error } = await q
          .order("expiry_date", { nullsFirst: false })
          .order("id")
          .range(
            (pageFor(stage) - 1) * BOARD_PAGE_SIZE,
            pageFor(stage) * BOARD_PAGE_SIZE - 1,
          );
        if (error) throw Error("Kolom kanban belum dapat dimuat.");
        return (data || []) as DataRow[];
      }),
    ),
  ]);
  if (error) throw Error("Ringkasan pipeline belum dapat dimuat.");
  const ids = columns.flat().map((r) => String(r.id));
  const { data: documents } = ids.length
    ? await db
        .from("operational_documents")
        .select("id,record_id,kind,original_name")
        .eq("domain", "client")
        .in("record_id", ids)
        .in("kind", ["quotation", "purchase_order"])
        .limit(500)
    : { data: [] };
  const summary = totals as Record<
    string,
    { count: number; amount: string; examples: number }
  >;
  const demo = Object.values(summary).reduce((s, v) => s + v.examples, 0);
  return (
    <>
      <PageHeader
        title="Pipeline Perpanjangan"
        description="Antrean AM untuk sertifikat yang berakhir dalam 90 hari, sudah kedaluwarsa, atau sudah memiliki riwayat tindak lanjut."
      />
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold">
              Mulai sebelum jatuh tempo, lanjutkan sampai selesai
            </h2>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-muted-foreground">
              H−90 / kedaluwarsa → hubungi PIC → catat penawaran PDF →
              konfirmasi PO PDF. PO diterima belum memperpanjang sertifikat:
              masukkan generasi baru setelah terbit. Riwayat tindak lanjut tetap
              tampil. Setiap tahap menampilkan kartu terdekat; gunakan halaman
              untuk kartu lainnya.
            </p>
          </div>
          <Link
            className="text-xs underline"
            href={
              "?branch=" +
              c.branch +
              "&examples=" +
              (include ? "false" : "true")
            }
          >
            {include ? "Sembunyikan contoh" : "Tampilkan contoh"}
          </Link>
        </div>
        {demo > 0 && (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs">
            MODE CONTOH · {demo} kartu dummy. Jumlah/nilai pada papan ini
            mencakup contoh yang berlabel; data contoh tidak masuk peluang
            perpanjangan riil dashboard.
          </p>
        )}
      </Card>
      <div
        className="min-w-0 pb-3"
        role="region"
        aria-label="Papan pipeline perpanjangan"
      >
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {stages.map(([stage, label, color], index) => (
            <Card
              key={stage}
              className={
                "min-h-[220px] min-w-0 border-t-4 bg-slate-50 p-2.5 " + color
              }
            >
              <div className="mb-3 border-b border-border pb-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-bold">{label}</h2>
                  <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] tabular-nums">
                    {summary[stage]?.count || 0}
                  </span>
                </div>
                <p className="mt-2 text-[11px] tabular-nums">
                  {formatRupiah(summary[stage]?.amount || "0")}
                </p>
              </div>
              <div className="space-y-3">
                {columns[index].length ? (
                  columns[index].map((row) => (
                    <article
                      key={String(row.id)}
                      className="min-w-0 rounded-lg border border-border bg-white p-2.5 shadow-sm"
                    >
                      <Link
                        className="line-clamp-2 break-words text-xs font-bold leading-4 text-brand-navy hover:underline"
                        title={String(row.client_name)}
                        href={
                          "/sertifikat-klien/" + row.id + "?branch=" + c.branch
                        }
                      >
                        {String(row.client_name)}
                      </Link>
                      {row.is_example === true && (
                        <span className="mt-1 block text-[10px] font-semibold text-amber-800">
                          [CONTOH]
                        </span>
                      )}
                      <p
                        title={String(row.certificate_number || "")}
                        className="mt-1 truncate text-[10px] text-muted-foreground"
                      >
                        {String(row.certificate_number || "Nomor belum diisi")}
                      </p>
                      <p
                        title={String(row.certificate_type_name)}
                        className="my-2 line-clamp-1 text-[10px]"
                      >
                        {String(row.certificate_type_name)}
                      </p>
                      <div className="space-y-1 border-y border-border py-2 text-[10px]">
                        <p>
                          Jatuh tempo:{" "}
                          <strong>
                            {formatBusinessDate(
                              row.expiry_date as string | null,
                            )}
                          </strong>
                        </p>
                        <p>{remainingText(row.expiry_date)}</p>
                        <StatusBadge value={String(row.validity_status)} />
                      </div>
                      <p
                        className="mt-2 truncate text-[10px] text-muted-foreground"
                        title={String(
                          row.example_am_label ||
                            c.profile.full_name ||
                            "AM terdaftar",
                        )}
                      >
                        {String(
                          row.example_am_label ||
                            (row.account_manager_id === c.user.id
                              ? c.profile.full_name
                              : "AM terdaftar") ||
                            "AM belum ditugaskan",
                        )}
                      </p>
                      <p className="mt-2 break-words text-xs font-semibold text-primary-hover tabular-nums">
                        {formatRupiah(
                          String(
                            row.previous_order_value_text ||
                              row.previous_order_value ||
                              "0",
                          ),
                        )}
                      </p>
                      {c.canWrite && (
                        <PipelineAction
                          certificate={String(row.id)}
                          branch={c.branch}
                          stage={stage}
                          documents={(documents || [])
                            .filter((d) => d.record_id === row.id)
                            .map((d) => ({
                              id: String(d.id),
                              kind: String(d.kind),
                              original_name: String(d.original_name),
                            }))}
                        />
                      )}
                    </article>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                    Kosong
                  </p>
                )}
              </div>
              {(summary[stage]?.count || 0) > BOARD_PAGE_SIZE && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                  {pageFor(stage) > 1 && (
                    <Link
                      className="underline"
                      aria-label={"Halaman sebelumnya " + label}
                      href={pageLink(stage, pageFor(stage) - 1)}
                    >
                      Sebelumnya
                    </Link>
                  )}
                  <span>
                    {pageFor(stage)} /{" "}
                    {Math.ceil(summary[stage].count / BOARD_PAGE_SIZE)}
                  </span>
                  {pageFor(stage) * BOARD_PAGE_SIZE < summary[stage].count && (
                    <Link
                      className="underline"
                      aria-label={"Halaman berikutnya " + label}
                      href={pageLink(stage, pageFor(stage) + 1)}
                    >
                      Berikutnya
                    </Link>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
