import {entityContext,masterClient} from "@/features/master-data/server";
import {hasPermission} from "@/lib/auth/permissions";
import {AccessDenied} from "@/components/ui/access-denied";
import {PageHeader} from "@/components/ui/page-header";
import {formatTimestamp} from "@/lib/format";
import {mailDeliveryStatus} from "@/lib/microsoft/delivery-config";
import {ReminderSettings} from "@/features/email-management/settings";
import {DeliveryControls} from "@/features/email-management/delivery-controls";
const labels:Record<string,string>={pending:"Dalam antrean",sending:"Sedang dikirim",accepted:"Diterima Microsoft 365",failed:"Gagal",uncertain:"Perlu pemeriksaan",cancelled:"Dibatalkan"};
export default async function EmailSettingsPage({searchParams}:{searchParams:Promise<{branch?:string}>}) {
  const c=await entityContext("sertifikat-klien",(await searchParams).branch);
  if(!hasPermission(c.scopes,c.branch,["admin"]))return <AccessDenied/>;
  const db=await masterClient(),provider=mailDeliveryStatus();
  const [settings,jobs]=await Promise.all([
    db.from("email_reminder_settings").select("enabled,days").eq("branch_code",c.branch).maybeSingle(),
    db.from("email_outbox").select("id,kind,mode,recipient,subject,state,result_code,created_at,provider_request_id").eq("branch_code",c.branch).order("created_at",{ascending:false}).limit(100),
  ]);
  return <div className="space-y-3"><PageHeader title="Email & Reminder Microsoft 365" description="Konfigurasi pengingat internal dan periksa riwayat pengiriman."/>
    <div className="rounded-xl border border-border bg-white p-4 text-sm"><p className="font-semibold">{provider.reason}</p><p className="mt-2">Pengirim: {provider.sender || "Mailbox organisasi belum ditentukan"}</p><p>Mode: {provider.mode}</p><p className="mt-2 text-xs text-muted-foreground">Diterima Microsoft 365 berarti permintaan diterima penyedia, belum membuktikan email tiba di inbox penerima. Hasil tidak pasti perlu diperiksa di Sent Items/Message Trace sebelum dikirim ulang.</p></div>
    {settings.error || jobs.error ? <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm">Data integrasi belum dapat dimuat. Periksa migrasi dan akses database.</p> : <>
      <ReminderSettings branch={c.branch} enabled={settings.data?.enabled || false} days={settings.data?.days || [90,60,30,7,0,-7,-30]} canManage={hasPermission(c.scopes,c.branch,["super_admin"])}/>
      <section className="overflow-hidden rounded-xl border border-border bg-white"><h2 className="p-4 font-bold">Riwayat pengiriman · 100 aktivitas terbaru</h2><div className="max-h-[65vh] overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50"><tr>{["Status","Waktu WITA","Penerima","Subjek","Jenis / mode","Kode hasil"].map(v=><th key={v} className="p-3">{v}</th>)}</tr></thead><tbody>{jobs.data?.map(job=><tr key={job.id} className="border-t border-border"><td className="p-3 font-semibold">{labels[job.state] || job.state}{hasPermission(c.scopes,c.branch,["super_admin"]) && <DeliveryControls branch={c.branch} job={job.id} state={job.state} code={job.result_code}/>}</td><td className="p-3">{formatTimestamp(job.created_at)}</td><td className="break-all p-3">{job.recipient}</td><td className="min-w-60 p-3">{job.subject}</td><td className="p-3">{job.kind} · {job.mode}</td><td className="p-3">{job.result_code || "—"}{job.provider_request_id && <span className="mt-1 block text-muted-foreground">Referensi: {job.provider_request_id}</span>}</td></tr>)}</tbody></table>{!jobs.data?.length && <p className="p-4 text-sm text-muted-foreground">Belum ada email dalam antrean. Membuka draf Outlook tidak masuk riwayat pengiriman langsung.</p>}</div></section>
    </>}
  </div>;
}
