import type {SupabaseClient} from "@supabase/supabase-js";
import {SIMULATION_BRANCH} from "@/lib/simulation";
export async function saveSimulationProfile(db:SupabaseClient,branch:string,id:string|undefined,details:Record<string,unknown>){
 if(branch!==SIMULATION_BRANCH)return {error:"Ruang simulasi tidak valid."};
 const payload:Record<string,unknown>={...details,branch_code:branch};
 // Passwords are never stored or passed to Auth in a simulation.
 delete payload.password;
 const q=id?db.from("simulation_profiles").update(payload).eq("id",id).eq("branch_code",branch):db.from("simulation_profiles").insert(payload);
 const {data,error}=await q.select("id").single();
 if(error||!data)return {error:"Profil simulasi belum tersimpan. Periksa email unik dan direktori pegawai latihan."};
 return {id:String(data.id)};
}
