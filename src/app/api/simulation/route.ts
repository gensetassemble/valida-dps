import { NextRequest,NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {cookies} from "next/headers";
import {createClient} from "@/lib/supabase/server";
import {SIMULATION_COOKIE,SIMULATION_BRANCH} from "@/lib/simulation";
import {isSameOrigin} from "@/lib/http/same-origin";
export async function POST(request:NextRequest){
  if(!isSameOrigin(request))return NextResponse.json({error:"Permintaan harus dari VALIDA."},{status:403});
  const input=await request.json().catch(()=>null);
  if(!input || typeof input.enabled!=="boolean")return NextResponse.json({error:"Pilihan tidak valid."},{status:400});
  const db=await createClient();const {data:{user},error}=await db.auth.getUser();
  if(error||!user)return NextResponse.json({error:"Silakan login kembali."},{status:401});
  if(input.enabled){
    const {data,error}=await (db as SupabaseClient).from("simulation_workspaces").select("branch_code").eq("profile_id",user.id).eq("is_active",true);
    if(error || !data?.some(w=>w.branch_code===SIMULATION_BRANCH))return NextResponse.json({error:"Akun ini tidak memiliki ruang simulasi."},{status:403});
  }
  (await cookies()).set(SIMULATION_COOKIE,input.enabled?"true":"",{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:input.enabled?8*60*60:0});
  return NextResponse.json({ok:true,href:input.enabled?`/dashboard?branch=${SIMULATION_BRANCH}`:"/dashboard"},{headers:{"Cache-Control":"no-store"}});
}
