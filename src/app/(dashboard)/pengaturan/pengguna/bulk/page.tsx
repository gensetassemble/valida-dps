import {redirect} from "next/navigation";
import {requireActiveUser} from "@/lib/auth/guards";
import {activeBranch} from "@/lib/auth/permissions";
import {PageHeader} from "@/components/ui/page-header";
import {AccessDenied} from "@/components/ui/access-denied";
import {hasSecondFactor} from "@/lib/auth/security";
import {masterClient} from "@/features/master-data/server";
import {BulkUserImport} from "@/features/bulk-users/import-form";
export default async function BulkUsersPage({searchParams}:{searchParams:Promise<{branch?:string}>}){
 const c=await requireActiveUser(),p=await searchParams;const branch=activeBranch(c.scopes,c.profile.branch_code,p.branch);
 if(!c.scopes.some(s=>s.branch_code===branch&&s.role_code==="super_admin"))return <AccessDenied/>;
 if(!(await hasSecondFactor(await masterClient())))redirect("/mfa");
 return <><PageHeader title="Pembuatan akun massal" description="Cocokkan direktori, tinjau peran, lalu buat akun tanpa mengirim email."/><BulkUserImport branch={branch}/></>;
}
