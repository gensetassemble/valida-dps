import {UrgentList} from './urgent-list';
import {requireActiveUser} from '@/lib/auth/guards';
import {dashboardScope} from '@/lib/auth/module-access';
import {masterClient} from '@/features/master-data/server';
import {todayWita} from '@/lib/domain/validity';
import type {ExpiringItem} from '@/features/operations/expiring-priorities';
import type {Filters} from './model';
import {urgentItems} from './urgent-model';
export async function UrgentNotifications({filters}:{filters:Filters}){
  if(filters.folder==='archive')return null;
  const c=await requireActiveUser(),branch=c.profile.branch_code;
  const {domains}=dashboardScope(c.scopes,branch);
  const db=await masterClient();
  const today=todayWita();
  const until=new Date(Date.parse(today)+30*86400000).toISOString().slice(0,10);
  const records:ExpiringItem[]=[];
  let failed=false;
  if(domains.length)for(let page=0;;page++){
    const {data,error}=await db.from('operational_scope_records').select('id,domain,entity_name,title,expiry_date,validity_status,is_example').eq('branch_code',branch).eq('is_example',false).in('domain',domains).lte('expiry_date',until).order('expiry_date').order('domain').order('id').range(page*1000,page*1000+999);
    if(error){failed=true;break;}
    records.push(...(data||[]) as ExpiringItem[]);
    if(!data||data.length<1000)break;
    if(page>=99){failed=true;break;}
  }
  if(failed)return <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Pengingat Expired/Kritis belum dapat dimuat. Tekan Refresh untuk mencoba kembali.</p>;
  const rows=urgentItems(records,{...filters,category:'all'},today);
  return <UrgentList rows={rows} branch={branch} today={today} domains={domains}/>;
}
