'use client';
import {useState} from 'react';
import Link from 'next/link';
import {formatBusinessDate} from '@/lib/format';
import {remainingDays} from '@/lib/domain/validity';
import {StatusBadge} from '@/components/ui/status-badge';
import type {ExpiringItem} from '@/features/operations/expiring-priorities';
import {CATEGORIES,type Category} from './model';
const routes:Record<string,string>={clients:'/sertifikat-klien',personnel:'/kompetensi-personil',calibrations:'/kalibrasi-alat'};
const options=[['all','Semua'],['calibrations','Kalibrasi Alat'],['personnel','Personil'],['clients','Klien']] as const;
export function UrgentList({rows,branch,today,domains}:{rows:ExpiringItem[];branch:string;today:string;domains:string[]}){
  const [selected,setSelected]=useState('all');
  const category=selected==='all'||domains.includes(selected)?selected:'all';
  const visible=category==='all'?rows:rows.filter(r=>r.domain===category);
  return <section aria-label="Pengingat Expired dan Kritis" className="overflow-hidden rounded-xl border border-border bg-white">
    <div className="border-b border-border px-3 py-2.5">
      <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold">Expired &amp; Kritis</h2><span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700" aria-live="polite">{visible.length}</span></div>
      <p className="mt-1 text-[11px] text-muted-foreground">Prioritas aktif · diperbarui dari tanggal berakhir.</p>
      <div role="group" aria-label="Kategori sertifikat prioritas" className="mt-2 grid grid-cols-2 gap-1.5">
        {options.filter(([value])=>value==='all'||domains.includes(value)).map(([value,label])=><button key={value} type="button" aria-pressed={category===value} onClick={()=>setSelected(value)} className={`flex min-h-9 items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold transition-colors ${category===value?'border-primary bg-primary text-white':'border-border bg-white text-brand-navy hover:border-primary hover:bg-teal-50'}`}><span>{label}</span><span className="text-[10px] opacity-80">{value==='all'?rows.length:rows.filter(r=>r.domain===value).length}</span></button>)}
      </div>
    </div>
    {visible.length?<ul className="max-h-[min(65vh,720px)] divide-y divide-border overflow-y-auto">{visible.map(r=>{const days=remainingDays(r.expiry_date,today)!;return <li key={`${r.domain}:${r.id}`} className="px-3 py-2.5 hover:bg-[#effaf9]"><div className="mb-1 flex flex-wrap items-center justify-between gap-2"><StatusBadge value={days<0?'Expired':'Kritis'}/><span className={`text-[11px] font-semibold ${days<0?'text-red-700':'text-amber-800'}`}>{days<0?`${-days} hari lewat`:`${days} hari lagi`}</span></div><Link className="block text-sm font-semibold leading-snug text-primary underline-offset-2 hover:underline" href={`${routes[r.domain]}/${r.id}?branch=${encodeURIComponent(branch)}`}>{r.entity_name}</Link><p className="mt-0.5 break-words text-xs leading-snug">{r.title||r.certificate_kind||'—'}</p><p className="mt-1 flex flex-wrap gap-x-2 text-[10px] leading-snug text-muted-foreground"><span>{CATEGORIES[r.domain as Category]?.label}{r.portfolio_code?` · ${r.portfolio_code}`:''}</span><span>Berakhir {formatBusinessDate(r.expiry_date)}</span></p></li>;})}</ul>:<p className="p-4 text-xs text-muted-foreground">Tidak ada data Expired atau Kritis untuk kategori ini.</p>}
  </section>;
}
