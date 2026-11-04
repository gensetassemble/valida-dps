import Link from "next/link";
import {entityContext,masterClient} from "@/features/master-data/server";
import {hasPermission} from "@/lib/auth/permissions";
import {AccessDenied} from "@/components/ui/access-denied";
import {PageHeader} from "@/components/ui/page-header";
import {formatTimestamp} from "@/lib/format";
import {loadEmailTemplate} from "@/features/operations/email-server";
import {EmailTemplateEditor} from "@/features/operations/email-template-editor";
import {renewalEmailProviderStatus} from "@/features/operations/email-provider-status";
export default async function EmailTemplatePage({searchParams}:{searchParams:Promise<{branch?:string}>}) {
  const c=await entityContext("sertifikat-klien",(await searchParams).branch);
  if(!hasPermission(c.scopes,c.branch,["admin"]))return <AccessDenied/>;
  const template=await loadEmailTemplate(c.branch),db=await masterClient();
  const {data:versions}=await db.from("client_renewal_email_templates").select("id,version,created_at").eq("branch_code",c.branch).order("version",{ascending:false}).limit(20);
  return <>
    <Link href={`/pengaturan/pengguna?branch=${c.branch}`} className="text-xs text-primary-hover underline">Pengaturan pengguna</Link>
    <PageHeader title="Template Email Perpanjangan" description="Kelola email koordinasi awal pelanggan. Perubahan disimpan sebagai versi baru dan dicatat di audit."/>
    <p className="mb-4 rounded-lg border border-border bg-white p-3 text-xs leading-5">{renewalEmailProviderStatus().reason}</p>
    <EmailTemplateEditor branch={c.branch} template={template}/>
    <details className="mt-4 rounded-lg border border-border bg-white p-4 text-xs"><summary className="cursor-pointer font-semibold">Riwayat versi template</summary><ul className="mt-3 space-y-2">{versions?.length ? versions.map(v=><li key={v.id}>Versi {v.version} · {formatTimestamp(v.created_at)}</li>) : <li>Belum ada perubahan. Template standar digunakan.</li>}</ul><p className="mt-3 text-muted-foreground">Isi versi sebelumnya dan aktor perubahan tersimpan pada audit; pemulihan template standar membuat versi baru.</p></details>
  </>;
}
