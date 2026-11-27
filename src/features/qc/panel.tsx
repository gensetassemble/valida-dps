import { requireActiveUser } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { masterClient } from "@/features/master-data/server";
import { loadQcThreads } from "./actions";
import { QcConversations } from "./conversations";
import type { QcDomain } from "./model";

export async function QcPanel({branch,domain,record}:{branch:string;domain:QcDomain;record:string}) {
  const c=await requireActiveUser(),db=await masterClient();
  const [initial,{data:docs},{data:permissions}]=await Promise.all([
    loadQcThreads({branch,domain,record}),
    db.from("operational_documents").select("id,original_name").eq("branch_code",branch).eq("domain",domain).eq("record_id",record).order("created_at",{ascending:false}).limit(100),
    db.rpc("qc_permissions",{b:branch,d:domain,r:record}),
  ]);
  return <QcConversations branch={branch} domain={domain} record={record} initial={initial}
    reviewer={hasPermission(c.scopes,branch,["qshe","super_admin"])} responder={permissions?.respond===true}
    documents={(docs||[]).map(d=>({id:String(d.id),name:String(d.original_name)}))}/>;
}
