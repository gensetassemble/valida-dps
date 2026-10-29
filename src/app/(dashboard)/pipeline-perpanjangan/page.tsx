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
const stages = [
  ["uncontacted", "Belum Dihubungi", "border-t-slate-400"],
  ["contacted", "Dihubungi", "border-t-blue-500"],
  ["offered", "Penawaran Terkirim", "border-t-amber-500"],
  ["po_received", "PO Diterima", "border-t-emerald-500"],
  ["deferred", "Ditunda", "border-t-purple-500"],
  ["not_renewed", "Tidak Diperpanjang", "border-t-pink-500"],
];
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; examples?: string }>;
}) {
  const p = await searchParams,
    c = await pageEntityContext("sertifikat-klien", p.branch),
    db = await masterClient(),
    include = p.examples !== "false";
  if (!c) return <AccessDenied />;
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
          .limit(20);
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
        description="Kanban tindak lanjut Account Manager dengan gerbang PIC, catatan kontak dan bukti PDF penawaran/PO."
      />
      <Card className="mb-5 p-5">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold">
              Setiap perpindahan tahap diperiksa server
            </h2>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-muted-foreground">
              Aktivitas dicatat berdasarkan bukti dan konfirmasi pengguna.
              Aplikasi ini tidak mengirim email. Kepala Cabang memiliki akses
              baca; AM mengikuti penugasan pelanggan saat ini.
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
        className="overflow-x-auto pb-4"
        tabIndex={0}
        role="region"
        aria-label="Papan pipeline perpanjangan"
      >
        <div className="grid min-w-[1320px] grid-cols-6 gap-4">
          {stages.map(([stage, label, color], index) => (
            <Card
              key={stage}
              className={"min-h-[450px] border-t-4 bg-slate-50 p-3 " + color}
            >
              <div className="mb-4 border-b border-border pb-3">
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
                      className="rounded-lg border border-border bg-white p-3 shadow-sm"
                    >
                      <Link
                        className="text-xs font-bold text-brand-navy hover:underline"
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
                      <p className="mt-1 break-all text-[10px] text-muted-foreground">
                        {String(row.certificate_number || "Nomor belum diisi")}
                      </p>
                      <p className="my-3 text-xs">
                        {String(row.certificate_type_name)}
                      </p>
                      <div className="space-y-2 border-y border-border py-3 text-[11px]">
                        <p>
                          Jatuh tempo:{" "}
                          <strong>
                            {formatBusinessDate(
                              row.expiry_date as string | null,
                            )}
                          </strong>
                        </p>
                        <p>
                          {row.expiry_date
                            ? remainingDays(String(row.expiry_date)) + " hari"
                            : "Tanggal belum diketahui"}
                        </p>
                        <StatusBadge value={String(row.validity_status)} />
                      </div>
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        {String(
                          row.example_am_label ||
                            (row.account_manager_id === c.user.id
                              ? c.profile.full_name
                              : "AM terdaftar") ||
                            "AM belum ditugaskan",
                        )}
                      </p>
                      <p className="mt-2 font-semibold text-primary-hover tabular-nums">
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
              {(summary[stage]?.count || 0) > 20 && (
                <p className="mt-3 text-[11px]">
                  20 kartu terdekat dari {summary[stage].count}; persempit
                  melalui daftar sertifikat.
                </p>
              )}
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
