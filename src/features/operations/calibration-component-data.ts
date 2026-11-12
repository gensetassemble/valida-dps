import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {DataRow} from '@/features/master-data/server';
import {componentReportRow} from './calibration-components';
export async function currentComponentData(db:SupabaseClient,branch:string,ids:string[]) {
  const rows:DataRow[]=[];
  for(let start=0;start<ids.length;start+=100){
    for(let page=0;;page++){
      const {data,error}=await db.from('current_equipment_calibrations').select('*').eq('branch_code',branch).in('equipment_id',ids.slice(start,start+100)).order('equipment_id').order('component_label',{nullsFirst:true}).order('id').range(page*1000,page*1000+999);
      if(error)throw Error('Sertifikat tiap bagian alat belum dapat dimuat. Silakan coba kembali.');
      rows.push(...(data||[]));if(!data||data.length<1000)break;
      if(page>=99)throw Error('Terlalu banyak sertifikat bagian alat; persempit ekspor.');
    }
  }
  return rows;
}
export async function componentExportData(db:SupabaseClient,rows:DataRow[],branch:string){
  const parts=await currentComponentData(db,branch,rows.map(r=>String(r.id)));
  const byEquipment=new Map<string,DataRow[]>();
  for(const p of parts){const id=String(p.equipment_id);const list=byEquipment.get(id)||[];list.push(p);byEquipment.set(id,list);}
  return rows.map(row=>{
    const components=(byEquipment.get(String(row.id))||[]).filter(p=>p.component_label);
    return components.length ? {...row,calibration_components:components.map(p=>componentReportRow(row,p))} : row;
  });
}
