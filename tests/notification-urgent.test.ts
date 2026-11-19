import {it,expect} from 'vitest';
import {urgentItems} from '@/features/notifications/urgent-model';
const filters={category:'all' as const,state:'all' as const,q:''};
const base={domain:'personnel',entity_name:'Pemilik Sertifikat',title:'Lisensi A',validity_status:'Aman',is_example:false};
it('shows expired and H0–H30 records, excluding safe, missing-date and example records',()=>{
 const rows=['2026-11-18','2026-11-19','2026-12-19','2026-12-20',''].map((expiry_date,i)=>({...base,id:String(i),expiry_date}));
 rows.push({...base,id:'example',expiry_date:'2026-11-01',is_example:true});
 expect(urgentItems(rows,filters,'2026-11-19').map(r=>r.id)).toEqual(['0','1','2']);
 expect(urgentItems(rows,{...filters,category:'calibrations'},'2026-11-19')).toEqual([]);
 expect(urgentItems(rows,{...filters,q:'tidak ada'},'2026-11-19')).toEqual([]);
});
