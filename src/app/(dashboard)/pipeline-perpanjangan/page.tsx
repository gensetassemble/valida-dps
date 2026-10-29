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
import { PipelineAction } from "@/features/operations/pipeline-action";
import { formatRupiah } from "@/lib/format";
import { remainingDays } from "@/lib/domain/validity";
import { safeSearch } from "@/features/master-data/validation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AutoFilterForm } from "@/components/ui/auto-filter-form";
import {
  PipelineDragProvider,
  PipelineDropColumn,
  PipelineDragHandle,
} from "@/features/operations/pipeline-drag";
import { DeadlineDate } from "@/components/ui/deadline-date";
import { ScrollMore } from "@/components/ui/scroll-more";
const BOARD_PAGE_SIZE = 20;
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
  const search = safeSearch(p.q || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(" ");
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
  const { data: board, error } = await db.rpc("renewal_board_page", {
    b: c.branch,
    search_text: search,
    include_examples: include,
    stage_limits: Object.fromEntries(
      stages.map(([stage]) => [
        stage,
        Math.min(1000, pageFor(stage) * BOARD_PAGE_SIZE),
      ]),
    ),
  });
  if (error) throw Error("Ringkasan pipeline belum dapat dimuat.");
  const result = board as {
    summary: Record<
      string,
      { count: number; amount: string; examples: number }
    >;
    columns: Record<string, DataRow[]>;
  };
  const columns = stages.map(([stage]) => result.columns[stage] || []);
  const ids = columns.flat().map((r) => String(r.id));
  const [{ data: documents }, { data: contacts }] = await Promise.all([
    ids.length
      ? db
          .from("operational_documents")
          .select("id,record_id,kind,original_name")
          .eq("domain", "client")
          .in("record_id", ids)
          .in("kind", ["quotation", "purchase_order"])
          .limit(500)
      : Promise.resolve({ data: [] }),
    ids.length
      ? db
          .from("client_contacts")
          .select("id,client_id,name,email,verification_status,is_primary")
          .in("client_id", [
            ...new Set(columns.flat().map((r) => String(r.client_id))),
          ])
          .eq("is_active", true)
          .eq("is_primary", true)
          .eq("verification_status", "verified")
          .limit(500)
      : Promise.resolve({ data: [] }),
  ]);
  const summary = result.summary;
  return (
    <>
      <PageHeader
        title="Pipeline Perpanjangan"
        actions={
          <Link
            className="text-xs underline"
            href={
              "?branch=" +
              c.branch +
              "&examples=" +
              (include ? "false" : "true") +
              (search ? "&q=" + encodeURIComponent(search) : "")
            }
          >
            {include ? "Sembunyikan contoh" : "Tampilkan contoh"}
          </Link>
        }
      />
      <AutoFilterForm
        searchLabel="Pencarian pipeline"
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="branch" value={c.branch} />
        <input
          type="hidden"
          name="examples"
          value={include ? "true" : "false"}
        />
        <Input
          aria-label="Cari pipeline"
          name="q"
          defaultValue={p.q || ""}
          maxLength={100}
          placeholder="Pelanggan, nomor sertifikat, objek, atau AM…"
          className="h-9 w-full sm:w-80"
        />
        <Button size="sm">Cari</Button>
        {search && (
          <Link
            className="text-xs underline"
            href={
              "?branch=" +
              c.branch +
              "&examples=" +
              (include ? "true" : "false")
            }
          >
            Hapus pencarian
          </Link>
        )}
      </AutoFilterForm>
      <PipelineDragProvider>
        <div
          className="min-w-0 pb-3"
          role="region"
          aria-label="Papan pipeline perpanjangan"
        >
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {stages.map(([stage, label, color], index) => (
              <PipelineDropColumn key={stage} stage={stage} label={label}>
                <Card
                  className={
                    "min-h-[calc(100dvh-220px)] min-w-0 border-t-4 bg-slate-50 p-2.5 " +
                    color
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
                          <PipelineDragHandle
                            id={String(row.id)}
                            stage={stage}
                            customer={String(row.client_name)}
                            canWrite={c.canWrite}
                          />
                          <Link
                            className="line-clamp-2 break-words text-xs font-bold leading-4 text-brand-navy hover:underline"
                            title={String(row.client_name)}
                            href={
                              "/sertifikat-klien/" +
                              row.id +
                              "?branch=" +
                              c.branch
                            }
                          >
                            {String(row.client_name)}
                          </Link>
                          <p
                            title={String(row.certificate_number || "")}
                            className="mt-1 truncate text-[10px] text-muted-foreground"
                          >
                            {String(
                              row.certificate_number || "Nomor belum diisi",
                            )}
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
                              <DeadlineDate value={row.expiry_date} />
                            </p>
                            <p>{remainingText(row.expiry_date)}</p>
                            <StatusBadge value={String(row.validity_status)} />
                          </div>
                          <p
                            className="mt-2 truncate text-[10px] text-muted-foreground"
                            title={String(
                              row.account_manager_name ||
                                row.example_am_label ||
                                c.profile.full_name ||
                                "AM terdaftar",
                            )}
                          >
                            {String(
                              row.account_manager_name ||
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
                          <PipelineAction
                            certificate={String(row.id)}
                            customer={String(row.client_name)}
                            number={String(row.certificate_number || "")}
                            canWrite={c.canWrite}
                            contacts={(contacts || [])
                              .filter((v) => v.client_id === row.client_id)
                              .map((v) => ({
                                id: String(v.id),
                                name: String(v.name),
                                email: String(v.email || ""),
                              }))}
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
                        </article>
                      ))
                    ) : (
                      <p className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                        Kosong
                      </p>
                    )}
                  </div>
                  <ScrollMore
                    href={pageLink(stage, pageFor(stage) + 1)}
                    shown={columns[index].length}
                    total={summary[stage]?.count || 0}
                  />
                </Card>
              </PipelineDropColumn>
            ))}
          </div>
        </div>
      </PipelineDragProvider>
    </>
  );
}
