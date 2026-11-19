import {remainingDays} from '@/lib/domain/validity';
import type {ExpiringItem} from '@/features/operations/expiring-priorities';
import type {Filters} from './model';
export function urgentItems(records:ExpiringItem[],filters:Filters,today:string){
  const terms=filters.q.toLocaleLowerCase('id').split(/\s+/).filter(Boolean);
  return records.filter(r=>{
    const days=remainingDays(r.expiry_date,today);
    return !r.is_example && days!==null && days<=30 &&
      (filters.category==='all'||filters.category===r.domain) &&
      terms.every(t=>[r.entity_name,r.title,r.reference_number,r.portfolio_code].join(' ').toLocaleLowerCase('id').includes(t));
  }).sort((a,b)=>a.expiry_date.localeCompare(b.expiry_date)||a.entity_name.localeCompare(b.entity_name));
}
