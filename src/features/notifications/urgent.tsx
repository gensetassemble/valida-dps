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
    <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-bold">Perlu Tindakan · Expired &amp; Kritis <span className="ml-2 rounded-full bg-red-50 px-2 py-1 text-xs text-red-700">{rows.length}</span></h2><p className="mt-1 text-xs text-muted-foreground">Pengingat aktif sesuai akses akun. Diperbarui otomatis dari tanggal berakhir; terpisah dari status baca dan arsip notifikasi proses.</p></div>
    {rows.length?<div className="max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50"><tr>{['Status','Nama / alat / pelanggan','Sertifikat / lisensi','Berakhir','Pengingat',''].map((h,i)=><th key={i} className="p-3">{h}</th>)}</tr></thead><tbody>{rows.map(r=>{const days=remainingDays(r.expiry_date,today)!;return <tr key={`${r.domain}:${r.id}`} className="border-t border-border"><td className="p-3"><StatusBadge value={days<0?'Expired':'Kritis'}/></td><td className="p-3 font-semibold">{r.entity_name}<span className="mt-1 block text-[10px] font-normal text-muted-foreground">{CATEGORIES[r.domain as Category]?.label}{r.portfolio_code?` · ${r.portfolio_code}`:''}</span></td><td className="p-3 whitespace-pre-wrap">{r.title||r.certificate_kind||'—'}</td><td className="whitespace-nowrap p-3">{formatBusinessDate(r.expiry_date)}</td><td className={`whitespace-nowrap p-3 ${days<0?'text-red-700':'text-amber-800'}`}>{days<0?`${-days} hari lewat`:`${days} hari lagi`}</td><td className="p-3"><Link className="whitespace-nowrap font-semibold text-primary underline" href={`${routes[r.domain]}/${r.id}?branch=${encodeURIComponent(branch)}`}>Lihat rincian</Link></td></tr>;})}</tbody></table></div>:<p className="p-4 text-xs text-muted-foreground">Tidak ada data Expired atau Kritis sesuai pencarian dan akses Anda.</p>}
  </section>;
}
