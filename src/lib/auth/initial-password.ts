import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export async function initialPasswordRequired(db:SupabaseClient) {
 const {data,error}=await db.rpc("initial_password_change_required");
 if(error)throw Error("Status password awal belum dapat diperiksa.");
 return data===true;
}
