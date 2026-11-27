import {requireActiveUser} from "@/lib/auth/guards";
import {activeBranch} from "@/lib/auth/permissions";
import {PageHeader} from "@/components/ui/page-header";
import {AccessDenied} from "@/components/ui/access-denied";
import {BulkUserImport} from "@/features/bulk-users/import-form";
export default async function BulkUsersPage({searchParams}:{searchParams:Promise<{branch?:string}>}){
 const c=await requireActiveUser(),p=await searchParams;const branch=activeBranch(c.scopes,c.profile.branch_code,p.branch);
 if(!c.scopes.some(s=>s.branch_code===branch&&s.role_code==="super_admin"))return <AccessDenied/>;
 return <><PageHeader title="Pembuatan akun massal" description="Cocokkan direktori, tinjau peran, lalu buat akun tanpa mengirim email."/><BulkUserImport branch={branch}/></>;
}
