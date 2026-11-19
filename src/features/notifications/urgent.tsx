import Link from 'next/link';
import {requireActiveUser} from '@/lib/auth/guards';
import {dashboardScope} from '@/lib/auth/module-access';
import {masterClient} from '@/features/master-data/server';
import {formatBusinessDate} from '@/lib/format';
import {remainingDays,todayWita} from '@/lib/domain/validity';
import {StatusBadge} from '@/components/ui/status-badge';
import type {ExpiringItem} from '@/features/operations/expiring-priorities';
import {CATEGORIES,type Category,type Filters} from './model';
import {urgentItems} from './urgent-model';
const routes:Record<string,string>={clients:'/sertifikat-klien',personnel:'/kompetensi-personil',calibrations:'/kalibrasi-alat'};
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
  const rows=urgentItems(records,filters,today);
  return <section aria-label="Pengingat Expired dan Kritis" className="overflow-hidden rounded-xl border border-border bg-white">
    <div className="border-b border-border px-4 py-3"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold">Expired &amp; Kritis</h2><span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">{rows.length}</span></div><p className="mt-1 text-[11px] text-muted-foreground">Prioritas aktif · diperbarui dari tanggal berakhir.</p></div>
    {rows.length?<ul className="max-h-[min(65vh,720px)] divide-y divide-border overflow-y-auto">{rows.map(r=>{const days=remainingDays(r.expiry_date,today)!;return <li key={`${r.domain}:${r.id}`} className="px-4 py-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><StatusBadge value={days<0?'Expired':'Kritis'}/><span className={`text-[11px] font-semibold ${days<0?'text-red-700':'text-amber-800'}`}>{days<0?`${-days} hari lewat`:`${days} hari lagi`}</span></div><Link className="block text-sm font-semibold leading-5 text-primary underline-offset-2 hover:underline" href={`${routes[r.domain]}/${r.id}?branch=${encodeURIComponent(branch)}`}>{r.entity_name}</Link><p className="mt-1 break-words text-xs leading-5">{r.title||r.certificate_kind||'—'}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{CATEGORIES[r.domain as Category]?.label}{r.portfolio_code?` · ${r.portfolio_code}`:''}</p><p className="mt-1 text-[11px] text-muted-foreground">Berakhir {formatBusinessDate(r.expiry_date)}</p></li>;})}</ul>:<p className="p-4 text-xs text-muted-foreground">Tidak ada data Expired atau Kritis sesuai pencarian dan akses Anda.</p>}
  </section>;
}
